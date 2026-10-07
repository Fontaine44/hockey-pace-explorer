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
    """Load the exports into a fresh database, then replace the old file."""
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

    events = pd.read_parquet(PROJECT_ROOT / "data/processed/events_augmented.parquet")
    columns = [
        "event_id",
        "game_id",
        "period",
        "possession_id",
        "possession_team_id",
        "clock_seconds",
        "source_dataset",
    ]
    if not set(columns).issubset(events.columns):
        raise ValueError("events_augmented: missing possession columns")
    events = events[columns].sort_values("event_id", kind="stable")
    if events.isna().any().any():
        raise ValueError("events_augmented: required possession values are missing")
    for column in columns[:5]:
        if not is_integer_dtype(events[column]):
            raise ValueError(f"events_augmented: {column} must contain integers")
    if not events.event_id.is_unique:
        raise ValueError("events_augmented: duplicate event IDs")
    if not events.period.gt(0).all() or not events.clock_seconds.ge(0).all():
        raise ValueError("events_augmented: invalid period or clock")
    grouped = events.groupby("possession_id", sort=False)
    if (
        not grouped[["game_id", "period", "possession_team_id", "source_dataset"]]
        .nunique()
        .eq(1)
        .all()
        .all()
    ):
        raise ValueError("events_augmented: inconsistent possession context")
    event_context = grouped.agg(
        game_id=("game_id", "first"),
        period=("period", "first"),
        possession_team_id=("possession_team_id", "first"),
        source_dataset=("source_dataset", "first"),
        start_event_id=("event_id", "first"),
        end_event_id=("event_id", "last"),
        start_clock_seconds=("clock_seconds", "first"),
        end_clock_seconds=("clock_seconds", "last"),
        event_count=("event_id", "size"),
    ).reset_index()
    pace_columns = [
        "possession_id",
        "source_dataset",
        "game_id",
        "period",
        "possession_team_id",
        "events",
        "elapsed_seconds",
        "modeled_elapsed_seconds",
        "speed_total_ft_s",
        "pace_status",
    ]
    possessions = pd.read_parquet(
        PROJECT_ROOT / "data/processed/pace_sequences.parquet"
    )
    if not set(pace_columns).issubset(possessions.columns):
        raise ValueError("pace_sequences: missing required columns")
    possessions = possessions[pace_columns].rename(columns={"events": "event_count"})
    required = [
        c
        for c in possessions.columns
        if c not in {"elapsed_seconds", "modeled_elapsed_seconds", "speed_total_ft_s"}
    ]
    if possessions[required].isna().any().any():
        raise ValueError("pace_sequences: required values are missing")
    if not possessions.possession_id.is_unique:
        raise ValueError("pace_sequences: duplicate possession IDs")
    for column in [
        "possession_id",
        "game_id",
        "period",
        "possession_team_id",
        "event_count",
    ]:
        if not is_integer_dtype(possessions[column]):
            raise ValueError(f"pace_sequences: {column} must contain integers")
    if set(possessions.possession_id) != set(event_context.possession_id):
        raise ValueError("pace_sequences: possessions do not match augmented events")
    context = event_context.set_index("possession_id")
    for column in [
        "source_dataset",
        "game_id",
        "period",
        "possession_team_id",
        "event_count",
    ]:
        if (
            not possessions[column]
            .eq(possessions.possession_id.map(context[column]))
            .all()
        ):
            raise ValueError(
                f"pace_sequences: {column} does not match augmented events"
            )
    for column in ["elapsed_seconds", "modeled_elapsed_seconds", "speed_total_ft_s"]:
        values = possessions[column].dropna()
        if not values.map(
            lambda value: isinstance(value, (int, float)) and 0 <= value < float("inf")
        ).all():
            raise ValueError(f"pace_sequences: invalid {column}")
    possessions = possessions.merge(
        event_context[
            [
                "possession_id",
                "start_event_id",
                "end_event_id",
                "start_clock_seconds",
                "end_clock_seconds",
            ]
        ],
        on="possession_id",
        validate="one_to_one",
    )
    if possessions.end_clock_seconds.gt(possessions.start_clock_seconds).any():
        raise ValueError("events_augmented: possession clocks run backwards")
    game_lookup = games.set_index("game_id")
    if not possessions.game_id.isin(game_lookup.index).all():
        raise ValueError("possessions: unknown game")
    if not possessions.source_dataset.eq(
        possessions.game_id.map(game_lookup.source_dataset)
    ).all():
        raise ValueError("possessions: game source dataset mismatch")
    home = possessions.game_id.map(game_lookup.home_team_id)
    away = possessions.game_id.map(game_lookup.away_team_id)
    if not (
        possessions.possession_team_id.eq(home)
        | possessions.possession_team_id.eq(away)
    ).all():
        raise ValueError("possessions: controlling team is not in the game")

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
                CREATE TABLE possessions (
                    possession_id INTEGER PRIMARY KEY,
                    game_id INTEGER NOT NULL REFERENCES games(game_id),
                    period INTEGER NOT NULL CHECK (period > 0),
                    possession_team_id INTEGER NOT NULL REFERENCES teams(team_id),
                    source_dataset TEXT NOT NULL,
                    start_event_id INTEGER NOT NULL,
                    end_event_id INTEGER NOT NULL,
                    start_clock_seconds REAL NOT NULL,
                    end_clock_seconds REAL NOT NULL,
                    event_count INTEGER NOT NULL,
                    elapsed_seconds REAL,
                    modeled_elapsed_seconds REAL,
                    speed_total_ft_s REAL,
                    pace_status TEXT NOT NULL
                );
                CREATE INDEX possessions_game_period
                    ON possessions(game_id, period, start_event_id);
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
                connection.executemany(
                    "INSERT INTO possessions VALUES "
                    "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        (
                            int(r.possession_id),
                            int(r.game_id),
                            int(r.period),
                            int(r.possession_team_id),
                            r.source_dataset,
                            int(r.start_event_id),
                            int(r.end_event_id),
                            float(r.start_clock_seconds),
                            float(r.end_clock_seconds),
                            int(r.event_count),
                            None
                            if pd.isna(r.elapsed_seconds)
                            else float(r.elapsed_seconds),
                            None
                            if pd.isna(r.modeled_elapsed_seconds)
                            else float(r.modeled_elapsed_seconds),
                            None
                            if pd.isna(r.speed_total_ft_s)
                            else float(r.speed_total_ft_s),
                            r.pace_status,
                        )
                        for r in possessions.itertuples(index=False)
                    ),
                )
            if connection.execute("PRAGMA foreign_key_check").fetchall():
                raise ValueError("Imported database contains invalid team references")
            for name, frame in [
                ("teams", teams),
                ("players", players),
                ("games", games),
                ("possessions", possessions),
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
        f"{len(games)} games, {len(possessions)} possessions into {database}"
    )


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sqlite3.Error) as error:
        raise SystemExit(f"Ingestion failed: {error}") from error
