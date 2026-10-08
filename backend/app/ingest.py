"""Load final notebook exports into SQLite. Stop the API before running this module."""

import math
import os
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

import pandas as pd
from pandas.api.types import is_bool_dtype, is_integer_dtype, is_numeric_dtype
from sqlalchemy.engine import make_url

from backend.app.core.config import PROJECT_ROOT, get_settings


def insert_table(connection: sqlite3.Connection, name: str, frame: pd.DataFrame) -> int:
    """Check an export against its SQLite columns, then insert its existing values."""
    schema = connection.execute(f"PRAGMA table_info({name})").fetchall()
    columns = [column[1] for column in schema]
    missing = set(columns) - set(frame.columns)
    if missing:
        raise ValueError(f"{name}: missing columns {sorted(missing)}")
    if not frame.columns.is_unique:
        raise ValueError(f"{name}: duplicate columns")
    frame = frame[columns].copy()
    for _, column, sql_type, required, _, primary_key in schema:
        values = frame[column]
        if (required or primary_key) and values.isna().any():
            raise ValueError(f"{name}: {column} contains missing required values")
        present = values.dropna()
        if present.empty:
            continue
        if sql_type == "INTEGER":
            if not (is_integer_dtype(values) or is_bool_dtype(values)):
                raise ValueError(f"{name}: {column} must contain integers or booleans")
        elif sql_type == "REAL":
            if not is_numeric_dtype(values) or is_bool_dtype(values):
                raise ValueError(f"{name}: {column} must contain numbers")
            if not present.map(math.isfinite).all():
                raise ValueError(f"{name}: {column} contains non-finite values")
        elif sql_type == "TEXT":
            if not present.map(lambda value: isinstance(value, str)).all():
                raise ValueError(f"{name}: {column} must contain strings")
            if required and present.str.strip().eq("").any():
                raise ValueError(f"{name}: {column} contains blank required values")
        elif sql_type == "DATE":
            dates = pd.to_datetime(values, errors="raise")
            if dates.isna().any() or not dates.eq(dates.dt.normalize()).all():
                raise ValueError(f"{name}: {column} must contain dates without times")
            frame[column] = dates.dt.strftime("%Y-%m-%d")

    rows = frame.astype(object).where(frame.notna(), None)
    placeholders = ", ".join("?" for _ in columns)
    connection.executemany(
        f"INSERT INTO {name} ({', '.join(columns)}) VALUES ({placeholders})",
        rows.itertuples(index=False, name=None),
    )
    count = connection.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
    if count != len(frame):
        raise ValueError(f"{name}: imported row count does not match export")
    return count


def check_relationships(connection: sqlite3.Connection) -> None:
    """Check context relationships beyond the database's ordinary foreign keys."""
    invalid = connection.execute("""
        SELECT 'players: team source mismatch' FROM players p
        JOIN teams t USING (team_id) WHERE p.source_dataset != t.source_dataset
        UNION ALL
        SELECT 'games: team/source mismatch' FROM games g
        JOIN teams h ON h.team_id = g.home_team_id
        JOIN teams a ON a.team_id = g.away_team_id
        WHERE g.home_team_id = g.away_team_id
           OR g.source_dataset != h.source_dataset
           OR g.source_dataset != a.source_dataset
        UNION ALL
        SELECT 'possessions: game/team/source/clock mismatch' FROM possessions p
        JOIN games g USING (game_id)
        WHERE p.possession_team_id NOT IN (g.home_team_id, g.away_team_id)
           OR p.source_dataset != g.source_dataset
           OR p.end_clock_seconds > p.start_clock_seconds
        UNION ALL
        SELECT 'events: game/team/possession mismatch' FROM events e
        JOIN games g USING (game_id)
        JOIN possessions p USING (possession_id)
        WHERE e.team_id != CASE WHEN e.is_home
            THEN g.home_team_id ELSE g.away_team_id END
           OR e.opponent_team_id != CASE WHEN e.is_home
            THEN g.away_team_id ELSE g.home_team_id END
           OR e.source_dataset != g.source_dataset
           OR e.game_id != p.game_id OR e.period != p.period
           OR e.possession_team_id != p.possession_team_id
        UNION ALL
        SELECT 'events: player source mismatch' FROM events e
        JOIN players p ON p.player_id IN (e.player_id, e.player_2_id)
        WHERE e.source_dataset != p.source_dataset
        UNION ALL
        SELECT 'game_team_pace: team is not in game' FROM game_team_pace p
        JOIN games g USING (game_id)
        WHERE p.team_id NOT IN (g.home_team_id, g.away_team_id)
        UNION ALL
        SELECT 'game_polygrid: team is not in game' FROM game_polygrid p
        JOIN games g USING (game_id)
        WHERE p.team_id NOT IN (g.home_team_id, g.away_team_id)
        LIMIT 1
    """).fetchone()
    if invalid:
        raise ValueError(invalid[0])
    if connection.execute("PRAGMA foreign_key_check").fetchall():
        raise ValueError("Imported database contains invalid references")


def main() -> None:
    """Import eight final exports, then replace the database after success."""
    processed = PROJECT_ROOT / "data" / "processed"
    teams = pd.read_parquet(processed / "teams_augmented.parquet")
    players = pd.read_parquet(processed / "players.parquet")
    games = pd.read_parquet(processed / "games.parquet")
    possessions = pd.read_parquet(processed / "possessions.parquet")
    events = pd.read_parquet(processed / "events_augmented.parquet")
    cells = pd.read_parquet(processed / "polygrid_cells.parquet")
    game_team_pace = pd.read_parquet(processed / "game_team_pace.parquet")
    game_polygrid = pd.read_parquet(processed / "game_polygrid.parquet")

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
            "Stop the API and close connections first."
        )

    descriptor, temporary_name = tempfile.mkstemp(
        prefix="ingest-", suffix=".db", dir=database.parent
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    counts = []
    try:
        with closing(sqlite3.connect(temporary)) as connection:
            connection.execute("PRAGMA foreign_keys = ON")
            connection.executescript("""
                CREATE TABLE teams (
                    team_id INTEGER PRIMARY KEY,
                    source_dataset TEXT NOT NULL,
                    team_name TEXT NOT NULL,
                    color TEXT
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
                CREATE TABLE game_team_pace (
                    game_id INTEGER NOT NULL REFERENCES games(game_id),
                    team_id INTEGER NOT NULL REFERENCES teams(team_id),
                    period INTEGER NOT NULL CHECK (period >= 0),
                    modeled_elapsed_seconds REAL NOT NULL
                        CHECK (modeled_elapsed_seconds >= 0),
                    distance_ft REAL NOT NULL CHECK (distance_ft >= 0),
                    distance_ew_ft REAL NOT NULL CHECK (distance_ew_ft >= 0),
                    distance_ns_ft REAL NOT NULL CHECK (distance_ns_ft >= 0),
                    distance_n_ft REAL NOT NULL CHECK (distance_n_ft >= 0),
                    speed_total_ft_s REAL CHECK (speed_total_ft_s >= 0),
                    speed_ew_ft_s REAL CHECK (speed_ew_ft_s >= 0),
                    speed_ns_ft_s REAL CHECK (speed_ns_ft_s >= 0),
                    speed_n_ft_s REAL CHECK (speed_n_ft_s >= 0),
                    PRIMARY KEY (game_id, team_id, period)
                );
                CREATE TABLE polygrid_cells (
                    cell_id INTEGER PRIMARY KEY,
                    grid_column INTEGER NOT NULL CHECK (grid_column BETWEEN 0 AND 39),
                    grid_row INTEGER NOT NULL CHECK (grid_row BETWEEN 0 AND 16),
                    x_min_ft REAL NOT NULL, x_max_ft REAL NOT NULL,
                    y_min_ft REAL NOT NULL, y_max_ft REAL NOT NULL,
                    UNIQUE (grid_row, grid_column)
                );
                CREATE TABLE game_polygrid (
                    game_id INTEGER NOT NULL REFERENCES games(game_id),
                    team_id INTEGER NOT NULL REFERENCES teams(team_id),
                    cell_id INTEGER NOT NULL REFERENCES polygrid_cells(cell_id),
                    modeled_elapsed_seconds REAL NOT NULL
                        CHECK (modeled_elapsed_seconds >= 0),
                    speed_total_ft_s REAL CHECK (speed_total_ft_s >= 0),
                    speed_ew_ft_s REAL CHECK (speed_ew_ft_s >= 0),
                    speed_ns_ft_s REAL CHECK (speed_ns_ft_s >= 0),
                    speed_n_ft_s REAL CHECK (speed_n_ft_s >= 0),
                    PRIMARY KEY (game_id, team_id, cell_id)
                );
            """)
            with connection:
                for name, frame in [
                    ("teams", teams),
                    ("players", players),
                    ("games", games),
                    ("possessions", possessions),
                    ("events", events),
                    ("polygrid_cells", cells),
                    ("game_team_pace", game_team_pace),
                    ("game_polygrid", game_polygrid),
                ]:
                    counts.append((name, insert_table(connection, name, frame)))
                check_relationships(connection)
        try:
            os.replace(temporary, database)
        except PermissionError as error:
            raise PermissionError(
                "Could not replace the database. "
                "Stop the API and close connections first."
            ) from error
    finally:
        temporary.unlink(missing_ok=True)

    for name, count in counts:
        print(f"Imported {count:,} {name} rows")
    print(f"Database: {database}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sqlite3.Error) as error:
        raise SystemExit(f"Ingestion failed: {error}") from error
