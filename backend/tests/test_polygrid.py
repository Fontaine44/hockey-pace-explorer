import hashlib
import sqlite3
from contextlib import closing
from types import SimpleNamespace

import pandas as pd
import pytest
from backend.app import ingest
from backend.app.api.routes.games import (
    PolygridCellResponse,
    TeamPaceResponse,
    get_game_pace,
    get_game_polygrid,
)
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


@pytest.fixture
def database(tmp_path, monkeypatch):
    path = tmp_path / "app.db"
    monkeypatch.setattr(
        ingest,
        "get_settings",
        lambda: SimpleNamespace(database_url=f"sqlite:///{path.as_posix()}"),
    )
    ingest.main()
    return path


def test_final_exports_repeat_import_and_endpoints(database, monkeypatch):
    exports = {
        "teams": ("teams", 20),
        "players": ("players", 435),
        "games": ("games", 34),
        "possessions": ("possessions", 16046),
        "events": ("events_augmented", 86670),
        "polygrid_cells": ("polygrid_cells", 668),
        "game_team_pace": ("game_team_pace", 282),
        "game_polygrid": ("game_polygrid", 45424),
    }
    read_parquet = pd.read_parquet
    reads = []

    def final_only(path, *args, **kwargs):
        assert path.stem in {file for file, _ in exports.values()}
        reads.append(path.stem)
        return read_parquet(path, *args, **kwargs)

    monkeypatch.setattr(pd, "read_parquet", final_only)
    ingest.main()
    assert len(reads) == 8
    with closing(sqlite3.connect(database)) as connection:
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
        for table, (file, count) in exports.items():
            source = read_parquet(
                ingest.PROJECT_ROOT / "data/processed" / f"{file}.parquet"
            )
            stored = pd.read_sql_query(f"SELECT * FROM {table}", connection)
            assert len(stored) == len(source) == count
            assert list(stored.columns) == list(source.columns)
            keys = [
                row[1]
                for row in connection.execute(f"PRAGMA table_info({table})")
                if row[5]
            ]
            source = source.sort_values(keys).reset_index(drop=True)
            stored = stored.sort_values(keys).reset_index(drop=True)
            if table == "games":
                stored["game_date"] = pd.to_datetime(stored["game_date"])
            for column in source:
                left, right = source[column], stored[column]
                assert left.isna().equals(right.isna()), (table, column)
                present = left.notna()
                assert left[present].eq(right[present]).all(), (table, column)
            assert not stored.duplicated(keys).any()

    engine = create_engine(f"sqlite:///{database.as_posix()}")
    with Session(engine) as session:
        pace = get_game_pace(16, session)
        assert len(pace) == 8 and {r["team_id"] for r in pace} == {8, 9}
        assert [(r["period"] or 0, r["team_id"]) for r in pace] == sorted(
            (r["period"] or 0, r["team_id"]) for r in pace
        )
        for record in pace:
            TeamPaceResponse.model_validate(record)
        with pytest.raises(HTTPException) as missing:
            get_game_pace(999999, session)
        assert missing.value.status_code == 404
        session.connection().exec_driver_sql(
            "UPDATE game_team_pace SET speed_total_ft_s = NULL "
            "WHERE game_id=16 AND period=0"
        )
        assert get_game_pace(16, session)[0]["speed_total_ft_s"] is None
        session.connection().exec_driver_sql(
            "DELETE FROM game_team_pace WHERE game_id=16"
        )
        assert get_game_pace(16, session) == []
        records = get_game_polygrid(16, session)
        assert len(records) == 1336 and len({r["team_id"] for r in records}) == 2
        assert [(r["team_id"], r["cell_id"]) for r in records] == sorted(
            (r["team_id"], r["cell_id"]) for r in records
        )
        assert any(r["speed_total_ft_s"] is None for r in records)
        for record in records:
            PolygridCellResponse.model_validate(record)
        with pytest.raises(HTTPException) as missing:
            get_game_polygrid(999999, session)
        assert missing.value.status_code == 404
        session.connection().exec_driver_sql(
            "DELETE FROM game_polygrid WHERE game_id=16"
        )
        assert get_game_polygrid(16, session) == []
    engine.dispose()


@pytest.mark.parametrize(
    "problem",
    [
        "missing_column",
        "missing_required",
        "invalid_type",
        "duplicate_key",
        "unknown_team",
        "wrong_game_team",
        "source_mismatch",
        "infinity",
        "nan_required",
    ],
)
def test_invalid_export_preserves_database(database, monkeypatch, problem):
    before = hashlib.sha256(database.read_bytes()).digest()
    read_parquet = pd.read_parquet

    def invalid_read(path, *args, **kwargs):
        frame = read_parquet(path, *args, **kwargs)
        if path.stem == "game_polygrid":
            if problem == "missing_column":
                frame = frame.drop(columns="cell_id")
            elif problem == "missing_required":
                frame.loc[0, "cell_id"] = pd.NA
            elif problem == "invalid_type":
                frame["cell_id"] = frame["cell_id"].astype("string")
            elif problem == "duplicate_key":
                frame = pd.concat([frame, frame.iloc[[0]]], ignore_index=True)
            elif problem == "unknown_team":
                frame.loc[0, "team_id"] = 999999
            elif problem == "wrong_game_team":
                frame.loc[0, "team_id"] = 1  # Known team, not in this game.
            elif problem == "infinity":
                frame.loc[0, "speed_total_ft_s"] = float("inf")
            elif problem == "nan_required":
                frame.loc[0, "modeled_elapsed_seconds"] = float("nan")
        if path.stem == "possessions" and problem == "source_mismatch":
            frame.loc[0, "source_dataset"] = "Other source"
        return frame

    monkeypatch.setattr(pd, "read_parquet", invalid_read)
    with pytest.raises((ValueError, sqlite3.IntegrityError)):
        ingest.main()
    assert hashlib.sha256(database.read_bytes()).digest() == before
    assert not list(database.parent.glob("ingest-*.db"))
