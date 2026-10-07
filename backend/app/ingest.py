"""Rebuild the analytical SQLite database. Stop the API before running this module."""

import os
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

import pandas as pd
from pandas.api.types import is_integer_dtype
from sqlalchemy.engine import make_url

from backend.app.core.config import PROJECT_ROOT, get_settings


def read_table(
    name: str, columns: list[str], integer_columns: list[str]
) -> pd.DataFrame:
    """Read an export and check the columns required by its database table."""
    frame = pd.read_parquet(PROJECT_ROOT / "data" / "processed" / f"{name}.parquet")
    missing = set(columns) - set(frame.columns)
    if missing:
        raise ValueError(f"{name}: missing columns {sorted(missing)}")
    frame = frame[columns].copy()
    if frame.isna().any().any():
        raise ValueError(f"{name}: required columns contain missing values")
    for column in integer_columns:
        if not is_integer_dtype(frame[column]):
            raise ValueError(f"{name}: {column} must contain integers")
    if not frame[integer_columns[0]].is_unique:
        raise ValueError(f"{name}: duplicate primary IDs")
    for column in columns:
        if (
            column not in integer_columns
            and column != "game_date"
            and not frame[column].map(lambda value: isinstance(value, str)).all()
        ):
            raise ValueError(f"{name}: {column} must contain strings")
    return frame


def main() -> None:
    """Load the three exports into a fresh database, then replace the old file."""
    teams = read_table("teams", ["team_id", "source_dataset", "team_name"], ["team_id"])
    players = read_table(
        "players",
        ["player_id", "player_name", "team_id", "source_dataset"],
        ["player_id", "team_id"],
    )
    games = read_table(
        "games",
        ["game_id", "game_date", "home_team_id", "away_team_id", "source_dataset"],
        ["game_id", "home_team_id", "away_team_id"],
    )

    team_sources = teams.set_index("team_id")["source_dataset"]
    for name, frame, column in [
        ("players", players, "team_id"),
        ("games", games, "home_team_id"),
        ("games", games, "away_team_id"),
    ]:
        if not frame[column].isin(team_sources.index).all():
            raise ValueError(f"{name}: {column} references an unknown team")
        if not frame["source_dataset"].eq(frame[column].map(team_sources)).all():
            raise ValueError(f"{name}: {column} references a different source dataset")

    dates = pd.to_datetime(games["game_date"], errors="raise")
    if dates.isna().any() or not dates.eq(dates.dt.normalize()).all():
        raise ValueError("games: game_date must contain dates without a time component")
    games["game_date"] = dates.dt.strftime("%Y-%m-%d")

    url = make_url(get_settings().database_url)
    if (
        url.get_backend_name() != "sqlite"
        or not url.database
        or url.database == ":memory:"
        or url.query
    ):
        raise ValueError("Ingestion requires a file-based SQLite DATABASE_URL")
    database = Path(url.database)
    if not database.is_absolute():
        database = PROJECT_ROOT / database
    database = database.resolve()
    database.parent.mkdir(parents=True, exist_ok=True)
    if any(
        Path(f"{database}{suffix}").exists() for suffix in ("-wal", "-shm", "-journal")
    ):
        raise ValueError(
            "SQLite journal files are present. "
            "Stop the API and close database connections first."
        )

    descriptor, temporary_name = tempfile.mkstemp(
        prefix="ingest-", suffix=".db", dir=database.parent
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        with closing(sqlite3.connect(temporary)) as connection:
            connection.execute("PRAGMA foreign_keys = ON")
            connection.executescript("""
                CREATE TABLE teams (
                    team_id INTEGER PRIMARY KEY,
                    source_dataset TEXT NOT NULL,
                    team_name TEXT NOT NULL
                );
                CREATE TABLE players (
                    player_id INTEGER PRIMARY KEY,
                    player_name TEXT NOT NULL,
                    team_id INTEGER NOT NULL REFERENCES teams(team_id),
                    source_dataset TEXT NOT NULL
                );
                CREATE TABLE games (
                    game_id INTEGER PRIMARY KEY,
                    game_date DATE NOT NULL,
                    home_team_id INTEGER NOT NULL REFERENCES teams(team_id),
                    away_team_id INTEGER NOT NULL REFERENCES teams(team_id),
                    source_dataset TEXT NOT NULL
                );
            """)
            with connection:
                connection.executemany(
                    "INSERT INTO teams VALUES (?, ?, ?)",
                    (
                        (int(r.team_id), r.source_dataset, r.team_name)
                        for r in teams.itertuples(index=False)
                    ),
                )
                connection.executemany(
                    "INSERT INTO players VALUES (?, ?, ?, ?)",
                    (
                        (
                            int(r.player_id),
                            r.player_name,
                            int(r.team_id),
                            r.source_dataset,
                        )
                        for r in players.itertuples(index=False)
                    ),
                )
                connection.executemany(
                    "INSERT INTO games VALUES (?, ?, ?, ?, ?)",
                    (
                        (
                            int(r.game_id),
                            r.game_date,
                            int(r.home_team_id),
                            int(r.away_team_id),
                            r.source_dataset,
                        )
                        for r in games.itertuples(index=False)
                    ),
                )
            if connection.execute("PRAGMA foreign_key_check").fetchall():
                raise ValueError("Imported database contains invalid team references")
            for name, frame in [
                ("teams", teams),
                ("players", players),
                ("games", games),
            ]:
                count = connection.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
                if count != len(frame):
                    raise ValueError(
                        f"{name}: imported row count does not match export"
                    )
        try:
            os.replace(temporary, database)
        except PermissionError as error:
            raise PermissionError(
                "Could not replace the database. "
                "Stop the API and close database connections first."
            ) from error
    finally:
        temporary.unlink(missing_ok=True)

    print(
        f"Imported {len(teams)} teams, {len(players)} players, "
        f"{len(games)} games into {database}"
    )


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sqlite3.Error) as error:
        raise SystemExit(f"Ingestion failed: {error}") from error
