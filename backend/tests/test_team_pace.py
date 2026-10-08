import sqlite3
from contextlib import closing

import pandas as pd
import pytest
from backend.app.ingest import insert_table


def test_sqlite_serialization_preserves_nulls_zeros_dates_and_booleans():
    with closing(sqlite3.connect(":memory:")) as connection:
        connection.execute(
            "CREATE TABLE sample (id INTEGER PRIMARY KEY, date DATE NOT NULL, "
            "flag INTEGER NOT NULL, speed REAL)"
        )
        frame = pd.DataFrame(
            {
                "id": pd.Series([1, 2], dtype="Int64"),
                "date": pd.to_datetime(["2022-02-08", "2022-02-09"]),
                "flag": pd.Series([True, False], dtype="boolean"),
                "speed": pd.Series([0, pd.NA], dtype="Float64"),
            }
        )
        assert insert_table(connection, "sample", frame) == 2
        assert connection.execute("SELECT * FROM sample ORDER BY id").fetchall() == [
            (1, "2022-02-08", 1, 0.0),
            (2, "2022-02-09", 0, None),
        ]


@pytest.mark.parametrize("date", [None, "2022-02-08 12:00:00", "invalid"])
def test_game_dates_reject_missing_times_and_invalid_values(date):
    with closing(sqlite3.connect(":memory:")) as connection:
        connection.execute(
            "CREATE TABLE sample (id INTEGER PRIMARY KEY, date DATE NOT NULL)"
        )
        with pytest.raises(ValueError):
            insert_table(
                connection, "sample", pd.DataFrame({"id": [1], "date": [date]})
            )
