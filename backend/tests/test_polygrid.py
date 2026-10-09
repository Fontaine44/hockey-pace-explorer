import hashlib
import sqlite3
from contextlib import closing
from types import SimpleNamespace

import pandas as pd
import pytest
from backend.app import ingest
from backend.app.api.routes.games import (
    GameResponse,
    PolygridCellResponse,
    TeamPaceResponse,
    get_game_pace,
    get_game_polygrid,
    get_games,
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
        "teams": ("teams_augmented", 20),
        "players": ("players", 435),
        "games": ("games", 34),
        "possessions": ("possessions", 16046),
        "events": ("events_augmented", 86670),
        "polygrid_cells": ("polygrid_cells", 668),
        "game_team_pace": ("game_team_pace", 282),
        "game_polygrid": ("game_polygrid", 45424),
        "entry_outcomes": ("entry_outcomes", 8),
        "pass_outcomes": ("pass_outcomes", 8),
        "shot_outcomes": ("shot_outcomes", 4),
        "oz_recovery_outcomes": ("oz_recovery_outcomes", 4),
        "entry_type_outcomes": ("entry_type_outcomes", 4),
        "dump_in_outcomes": ("dump_in_outcomes", 4),
    }
    read_parquet = pd.read_parquet
    reads = []

    def final_only(path, *args, **kwargs):
        assert path.stem in {file for file, _ in exports.values()}
        reads.append(path.stem)
        return read_parquet(path, *args, **kwargs)

    monkeypatch.setattr(pd, "read_parquet", final_only)
    ingest.main()
    assert len(reads) == len(exports)
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
        for source in ["Olympics 2022", "NWHL", "Womens"]:
            games = get_games(source, session)
            assert games
            for game in games:
                GameResponse.model_validate(game)
                for side in ["home", "away"]:
                    color = game[f"{side}_team_color"]
                    assert (color is not None) == (source == "Olympics 2022")
                    assert not game[f"{side}_team_name"].endswith(("(O22)", "(O18)"))
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


def test_augmented_team_names_colors_and_white_text_contrast():
    processed = ingest.PROJECT_ROOT / "data/processed"
    source = pd.read_parquet(processed / "teams.parquet")
    augmented = pd.read_parquet(processed / "teams_augmented.parquet")
    pd.testing.assert_series_equal(source["team_id"], augmented["team_id"])
    pd.testing.assert_series_equal(
        source["source_dataset"], augmented["source_dataset"]
    )
    expected_names = source["team_name"].str.replace(
        r"\s*\(O(?:22|18)\)$", "", regex=True
    )
    pd.testing.assert_series_equal(expected_names, augmented["team_name"])
    assert source["team_name"].str.endswith("(O22)").any()
    assert augmented["team_name"].str.endswith("(O19)").sum() == 3
    olympics = augmented["source_dataset"].eq("Olympics 2022")
    expected = {
        "Canada": "#C8102E",
        "Finland": "#0077B6",
        "Olympic Athletes from Russia": "#7B3294",
        "Switzerland": "#A65F00",
        "United States": "#002868",
    }
    assert augmented.loc[olympics].set_index("team_name")["color"].to_dict() == expected
    assert augmented.loc[~olympics, "color"].isna().all()
    assert str(augmented["color"].dtype) == "string"
    for color in expected.values():
        rgb = [int(color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
        linear = [
            v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb
        ]
        luminance = sum(
            v * weight
            for v, weight in zip(linear, [0.2126, 0.7152, 0.0722], strict=True)
        )
        assert 1.05 / (luminance + 0.05) >= 4.5
