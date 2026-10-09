import sqlite3
from contextlib import closing
from types import SimpleNamespace

import pandas as pd
import pytest
from backend.app import ingest

OUTCOME_TABLES = (
    "entry_outcomes",
    "pass_outcomes",
    "shot_outcomes",
    "oz_recovery_outcomes",
    "entry_type_outcomes",
    "dump_in_outcomes",
)


@pytest.fixture
def database(tmp_path, monkeypatch):
    path = tmp_path / "app.db"
    monkeypatch.setattr(
        ingest, "get_settings",
        lambda: SimpleNamespace(database_url=f"sqlite:///{path.as_posix()}"),
    )
    return path


def test_outcome_exports_import_exactly_and_repeat_without_duplicates(database):
    for _ in range(2):
        ingest.main()
        with closing(sqlite3.connect(database)) as connection:
            for table in OUTCOME_TABLES:
                expected = pd.read_parquet(
                    ingest.PROJECT_ROOT / "data" / "processed" / f"{table}.parquet"
                )
                actual = pd.read_sql_query(f"SELECT * FROM {table}", connection)
                actual = actual.astype(expected.dtypes.to_dict())
                pd.testing.assert_frame_equal(actual, expected, check_exact=True)
            assert connection.execute("PRAGMA foreign_key_check").fetchall() == []


@pytest.mark.parametrize("invalid", ["duplicate", "missing", "percentage", "nonfinite"])
def test_invalid_outcomes_preserve_previous_database(database, monkeypatch, invalid):
    previous = b"previous database must survive"
    database.write_bytes(previous)
    read_parquet = pd.read_parquet

    def read_export(path):
        frame = read_parquet(path)
        if path.name == "dump_in_outcomes.parquet":
            if invalid == "duplicate":
                frame = pd.concat([frame, frame.iloc[[0]]], ignore_index=True)
            elif invalid == "missing":
                frame = frame.drop(columns="unresolved")
            elif invalid == "percentage":
                frame.loc[0, "team_recovery_pct"] = 101
            else:
                frame.loc[0, "median_pace_ft_s"] = float("inf")
        return frame

    monkeypatch.setattr(ingest.pd, "read_parquet", read_export)
    with pytest.raises((ValueError, sqlite3.IntegrityError)):
        ingest.main()
    assert database.read_bytes() == previous
    assert not list(database.parent.glob("ingest-*.db"))


def test_nullable_outcome_values_preserve_nulls_and_zero(database, monkeypatch):
    read_parquet = pd.read_parquet

    def read_export(path):
        frame = read_parquet(path)
        if path.name == "shot_outcomes.parquet":
            frame.loc[0, "median_pace_ft_s"] = 0
            frame.loc[0, "mean_distance_ft"] = pd.NA
        if path.name == "oz_recovery_outcomes.parquet":
            frame.loc[0, "median_time_to_shot_seconds"] = pd.NA
        return frame

    monkeypatch.setattr(ingest.pd, "read_parquet", read_export)
    ingest.main()
    with closing(sqlite3.connect(database)) as connection:
        assert connection.execute(
            "SELECT median_pace_ft_s, mean_distance_ft "
            "FROM shot_outcomes WHERE quartile = 1"
        ).fetchone() == (0.0, None)
        assert connection.execute(
            "SELECT median_time_to_shot_seconds "
            "FROM oz_recovery_outcomes WHERE quartile = 1"
        ).fetchone() == (None,)
