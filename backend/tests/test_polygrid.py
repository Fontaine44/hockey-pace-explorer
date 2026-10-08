import hashlib
import sqlite3
from contextlib import closing
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest
from backend.app import ingest
from backend.app.api.routes.games import PolygridCellResponse, get_game_polygrid
from fastapi import HTTPException
from scipy.ndimage import gaussian_filter
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


def test_exposure_weighted_smoothing_and_blank_cells():
    cells = pd.DataFrame(
        {
            "cell_id": [0, 1, 2],
            "grid_column": [0, 1, 2],
            "grid_row": [0, 0, 0],
            "x_min_ft": [0, 5, 10],
            "x_max_ft": [5, 10, 15],
            "y_min_ft": [0, 0, 0],
            "y_max_ft": [5, 5, 5],
        }
    )
    games = pd.DataFrame({"game_id": [1], "home_team_id": [2], "away_team_id": [1]})
    possessions = pd.DataFrame(
        {
            "possession_id": [1],
            "game_id": [1],
            "period": [1],
            "possession_team_id": [1],
            "source_dataset": ["test"],
        }
    )
    events = pd.DataFrame({"event_id": [1, 2, 3, 4], "possession_id": [1] * 4})
    contributions = pd.DataFrame(
        {
            "game_id": [1] * 3,
            "possession_team_id": [1] * 3,
            "cell_id": [0, 1, 0],
            "source_dataset": ["test"] * 3,
            "period": [1] * 3,
            "possession_id": [1] * 3,
            "start_event_id": [1, 2, 3],
            "end_event_id": [2, 3, 4],
            "modeled_elapsed_seconds": [1.0, 9.0, 0.0],
            "distance_ft": [10.0, 270.0, 5.0],
            "distance_ew_ft": [5.0, 135.0, 2.5],
            "distance_ns_ft": [5.0, 135.0, 2.5],
            "distance_n_ft": [0.0, 0.0, 0.0],
        }
    )
    result = ingest.build_game_polygrids(
        cells, contributions, games, possessions, events
    )
    away = result[result.team_id.eq(1)].set_index("cell_id")
    time, distance = np.zeros((17, 40)), np.zeros((17, 40))
    time[0, :2] = [1, 9]
    distance[0, :2] = [15, 270]
    expected = gaussian_filter(distance, 2, mode="constant") / np.maximum(
        gaussian_filter(time, 2, mode="constant"), 1e-100
    )
    assert away.loc[0, "speed_total_ft_s"] == pytest.approx(expected[0, 0])
    assert away.loc[0, "speed_ew_ft_s"] == pytest.approx(expected[0, 0] / 2)
    assert away.loc[0, "speed_n_ft_s"] == 0
    assert np.isnan(away.loc[2, "speed_total_ft_s"])
    assert result[result.team_id.eq(2)].speed_total_ft_s.isna().all()
    assert away.modeled_elapsed_seconds.sum() == 10
    bad = contributions.copy()
    bad.loc[0, "distance_ft"] = np.inf
    with pytest.raises(ValueError, match="invalid distance or time"):
        ingest.build_game_polygrids(cells, bad, games, possessions, events)


def test_full_import_repeat_failure_and_endpoint(tmp_path, monkeypatch):
    database = tmp_path / "app.db"
    monkeypatch.setattr(
        ingest,
        "get_settings",
        lambda: SimpleNamespace(database_url=f"sqlite:///{database.as_posix()}"),
    )
    ingest.main()
    with closing(sqlite3.connect(database)) as connection:
        assert (
            connection.execute("SELECT COUNT(*) FROM game_polygrid").fetchone()[0]
            == 45424
        )
        assert (
            connection.execute("SELECT COUNT(*) FROM polygrid_cells").fetchone()[0]
            == 668
        )
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
        contributions = pd.read_parquet(
            ingest.PROJECT_ROOT / "data/processed/pace_polygrid_contributions.parquet"
        )
        actual = connection.execute(
            "SELECT SUM(modeled_elapsed_seconds) FROM game_polygrid"
        ).fetchone()[0]
        assert actual == pytest.approx(contributions.modeled_elapsed_seconds.sum())
        assert (
            connection.execute(
                "SELECT COUNT(*) FROM game_polygrid "
                "WHERE modeled_elapsed_seconds=0 AND speed_total_ft_s IS NOT NULL"
            ).fetchone()[0]
            == 0
        )
    ingest.main()
    before = hashlib.sha256(database.read_bytes()).digest()
    read_parquet = pd.read_parquet

    def invalid_read(path, *args, **kwargs):
        frame = read_parquet(path, *args, **kwargs)
        if path.name == "pace_polygrid_contributions.parquet":
            frame.loc[0, "possession_team_id"] = -1
        return frame

    monkeypatch.setattr(pd, "read_parquet", invalid_read)
    with pytest.raises(ValueError, match="possession_team_id mismatch"):
        ingest.main()
    assert hashlib.sha256(database.read_bytes()).digest() == before
    engine = create_engine(f"sqlite:///{database.as_posix()}")
    with Session(engine) as session:
        records = get_game_polygrid(16, session)
        assert len(records) == 1336
        assert len({r["team_id"] for r in records}) == 2
        assert [(r["team_id"], r["cell_id"]) for r in records] == sorted(
            (r["team_id"], r["cell_id"]) for r in records
        )
        assert any(r["speed_total_ft_s"] is None for r in records)
        for record in records:
            PolygridCellResponse.model_validate(record)
        with pytest.raises(HTTPException) as error:
            get_game_polygrid(999999, session)
        assert error.value.status_code == 404
        session.connection().exec_driver_sql(
            "DELETE FROM game_polygrid WHERE game_id = 16"
        )
        assert get_game_polygrid(16, session) == []
    engine.dispose()
