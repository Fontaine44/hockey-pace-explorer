"""Rebuild the analytical SQLite database. Stop the API before running this module."""

import os
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

import pandas as pd
from pandas.api.types import is_bool_dtype, is_integer_dtype
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
    event_columns = [
        "event_id",
        "game_id",
        "team_id",
        "opponent_team_id",
        "player_id",
        "player_2_id",
        "period",
        "clock_seconds",
        "team_goals",
        "opponent_goals",
        "team_skaters",
        "opponent_skaters",
        "event",
        "x",
        "y",
        "detail_1",
        "detail_2",
        "detail_3",
        "detail_4",
        "is_home",
        "source_dataset",
        "event_team_zone",
        "is_5v5",
        "score_differential",
        "modeled_clock_seconds",
        "possession_team_id",
        "possession_id",
    ]
    if not set(event_columns).issubset(events.columns):
        raise ValueError("events_augmented: missing required event columns")
    events = events[event_columns].sort_values("event_id", kind="stable")
    nullable_columns = {
        "player_2_id",
        "x",
        "y",
        "detail_1",
        "detail_2",
        "detail_3",
        "detail_4",
        "event_team_zone",
    }
    required = [column for column in event_columns if column not in nullable_columns]
    if events[required].isna().any().any():
        raise ValueError("events_augmented: required event values are missing")
    for column in [
        "event_id",
        "game_id",
        "team_id",
        "opponent_team_id",
        "player_id",
        "player_2_id",
        "period",
        "possession_id",
        "possession_team_id",
        "score_differential",
    ]:
        if not is_integer_dtype(events[column]):
            raise ValueError(f"events_augmented: {column} must contain integers")
    for column in [
        "source_dataset",
        "event_team_zone",
        "detail_1",
        "detail_2",
        "detail_3",
        "detail_4",
    ]:
        if not events[column].dropna().map(lambda value: isinstance(value, str)).all():
            raise ValueError(f"events_augmented: {column} must contain strings")
    for column in ["clock_seconds", "modeled_clock_seconds", "x", "y"]:
        if (
            not events[column]
            .dropna()
            .map(
                lambda value: (
                    isinstance(value, (int, float))
                    and -float("inf") < value < float("inf")
                )
            )
            .all()
        ):
            raise ValueError(f"events_augmented: invalid {column}")
    if not events.event_id.is_unique:
        raise ValueError("events_augmented: duplicate event IDs")
    if not events.event.map(lambda value: isinstance(value, str) and bool(value)).all():
        raise ValueError("events_augmented: event names must be nonempty strings")
    if not events.period.gt(0).all() or not events.clock_seconds.ge(0).all():
        raise ValueError("events_augmented: invalid period or clock")
    for column in ["team_goals", "opponent_goals", "team_skaters", "opponent_skaters"]:
        if not is_integer_dtype(events[column]) or not events[column].ge(0).all():
            raise ValueError(f"events_augmented: invalid {column}")
    for column in ["is_home", "is_5v5"]:
        if not is_bool_dtype(events[column]):
            raise ValueError(f"events_augmented: {column} must contain booleans")
    events["home_score"] = events.team_goals.where(
        events.is_home, events.opponent_goals
    )
    events["away_score"] = events.opponent_goals.where(
        events.is_home, events.team_goals
    )
    events["home_skaters"] = events.team_skaters.where(
        events.is_home, events.opponent_skaters
    )
    events["away_skaters"] = events.opponent_skaters.where(
        events.is_home, events.team_skaters
    )
    events["contains_goal"] = events.event.isin(["Goal", "Penalty Shot Goal"])
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
        outcome=("event", "last"),
        home_score=("home_score", "last"),
        away_score=("away_score", "last"),
        home_skaters=("home_skaters", "last"),
        away_skaters=("away_skaters", "last"),
        contains_goal=("contains_goal", "any"),
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
                "outcome",
                "home_score",
                "away_score",
                "home_skaters",
                "away_skaters",
                "contains_goal",
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
    possessions["home_score"] += (
        possessions.contains_goal & possessions.possession_team_id.eq(home)
    ).astype(int)
    possessions["away_score"] += (
        possessions.contains_goal & possessions.possession_team_id.eq(away)
    ).astype(int)
    event_home = events.game_id.map(game_lookup.home_team_id)
    event_away = events.game_id.map(game_lookup.away_team_id)
    if not (
        (events.team_id.eq(event_home) & events.opponent_team_id.eq(event_away))
        | (events.team_id.eq(event_away) & events.opponent_team_id.eq(event_home))
    ).all():
        raise ValueError("events_augmented: event teams do not match the game")
    if not events.is_home.eq(events.team_id.eq(event_home)).all():
        raise ValueError("events_augmented: is_home does not match the game")
    player_sources = players.set_index("player_id").source_dataset
    for column in ["player_id", "player_2_id"]:
        present = events.loc[events[column].notna()]
        if not present[column].isin(player_sources.index).all():
            raise ValueError(f"events_augmented: {column} references an unknown player")
        if not present.source_dataset.eq(present[column].map(player_sources)).all():
            raise ValueError(f"events_augmented: {column} source dataset mismatch")

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
                    pace_status TEXT NOT NULL,
                    outcome TEXT NOT NULL,
                    home_score INTEGER NOT NULL CHECK (home_score >= 0),
                    away_score INTEGER NOT NULL CHECK (away_score >= 0),
                    home_skaters INTEGER NOT NULL CHECK (home_skaters >= 0),
                    away_skaters INTEGER NOT NULL CHECK (away_skaters >= 0),
                    contains_goal INTEGER NOT NULL CHECK (contains_goal IN (0, 1))
                );
                CREATE INDEX possessions_game_period
                    ON possessions(game_id, period, start_event_id);
                CREATE TABLE events (
                    event_id INTEGER PRIMARY KEY,
                    game_id INTEGER NOT NULL REFERENCES games(game_id),
                    team_id INTEGER NOT NULL REFERENCES teams(team_id),
                    opponent_team_id INTEGER NOT NULL REFERENCES teams(team_id),
                    player_id INTEGER NOT NULL REFERENCES players(player_id),
                    player_2_id INTEGER REFERENCES players(player_id),
                    period INTEGER NOT NULL CHECK (period > 0),
                    clock_seconds REAL NOT NULL CHECK (clock_seconds >= 0),
                    team_goals INTEGER NOT NULL CHECK (team_goals >= 0),
                    opponent_goals INTEGER NOT NULL CHECK (opponent_goals >= 0),
                    team_skaters INTEGER NOT NULL CHECK (team_skaters >= 0),
                    opponent_skaters INTEGER NOT NULL CHECK (opponent_skaters >= 0),
                    event TEXT NOT NULL,
                    x REAL,
                    y REAL,
                    detail_1 TEXT,
                    detail_2 TEXT,
                    detail_3 TEXT,
                    detail_4 TEXT,
                    is_home INTEGER NOT NULL CHECK (is_home IN (0, 1)),
                    source_dataset TEXT NOT NULL,
                    event_team_zone TEXT,
                    is_5v5 INTEGER NOT NULL CHECK (is_5v5 IN (0, 1)),
                    score_differential INTEGER NOT NULL,
                    modeled_clock_seconds REAL NOT NULL,
                    possession_team_id INTEGER NOT NULL REFERENCES teams(team_id),
                    possession_id INTEGER NOT NULL REFERENCES possessions(possession_id)
                );
                CREATE INDEX events_possession
                    ON events(possession_id, event_id);
                CREATE INDEX events_game_period
                    ON events(game_id, period, event_id);
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
                    "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
                            r.outcome,
                            int(r.home_score),
                            int(r.away_score),
                            int(r.home_skaters),
                            int(r.away_skaters),
                            int(r.contains_goal),
                        )
                        for r in possessions.itertuples(index=False)
                    ),
                )
                # Convert pandas nullable values to None and native Python scalars.
                event_rows = events[event_columns].astype(object)
                event_rows = event_rows.where(event_rows.notna(), None)
                connection.executemany(
                    "INSERT INTO events VALUES "
                    "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
                    "?, ?, ?, ?, ?, ?, ?)",
                    event_rows.itertuples(index=False, name=None),
                )
            if connection.execute("PRAGMA foreign_key_check").fetchall():
                raise ValueError("Imported database contains invalid references")
            for name, frame in [
                ("teams", teams),
                ("players", players),
                ("games", games),
                ("possessions", possessions),
                ("events", events),
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
        f"{len(games)} games, {len(possessions)} possessions, "
        f"{len(events)} events into {database}"
    )


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sqlite3.Error) as error:
        raise SystemExit(f"Ingestion failed: {error}") from error
