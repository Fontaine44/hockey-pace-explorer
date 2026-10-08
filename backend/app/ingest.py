"""Rebuild the analytical SQLite database. Stop the API before running this module."""

import os
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

import numpy as np
import pandas as pd
from pandas.api.types import is_bool_dtype, is_integer_dtype
from scipy.ndimage import gaussian_filter
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


def build_game_polygrids(
    cells: pd.DataFrame,
    contributions: pd.DataFrame,
    games: pd.DataFrame,
    possessions: pd.DataFrame,
    events: pd.DataFrame,
) -> pd.DataFrame:
    """Pool all situations, then smooth distance and time before dividing."""
    geometry = [
        "cell_id",
        "grid_column",
        "grid_row",
        "x_min_ft",
        "x_max_ft",
        "y_min_ft",
        "y_max_ft",
    ]
    keys = ["game_id", "possession_team_id", "cell_id"]
    distances = ["distance_ft", "distance_ew_ft", "distance_ns_ft", "distance_n_ft"]
    speeds = ["speed_total_ft_s", "speed_ew_ft_s", "speed_ns_ft_s", "speed_n_ft_s"]
    allocations = ["modeled_elapsed_seconds", *distances]
    references = [
        "source_dataset",
        "period",
        "possession_id",
        "start_event_id",
        "end_event_id",
    ]
    if not set(geometry).issubset(cells.columns):
        raise ValueError("polygrid_cells: missing geometry columns")
    if not set(keys + allocations + references).issubset(contributions.columns):
        raise ValueError("polygrid_contributions: missing required columns")
    if cells[geometry].isna().any().any() or not cells.cell_id.is_unique:
        raise ValueError("polygrid_cells: missing values or duplicate cells")
    for column in ["cell_id", "grid_column", "grid_row"]:
        if not is_integer_dtype(cells[column]):
            raise ValueError(f"polygrid_cells: invalid {column}")
    if (
        cells.duplicated(["grid_row", "grid_column"]).any()
        or not cells.grid_row.between(0, 16).all()
        or not cells.grid_column.between(0, 39).all()
    ):
        raise ValueError("polygrid_cells: invalid grid positions")
    for column, expected in [
        ("x_min_ft", cells.grid_column * 5),
        ("x_max_ft", (cells.grid_column + 1) * 5),
        ("y_min_ft", cells.grid_row * 5),
        ("y_max_ft", (cells.grid_row + 1) * 5),
    ]:
        if not cells[column].eq(expected).all():
            raise ValueError("polygrid_cells: geometry does not match 5-foot grid")
    required = keys + allocations + references
    if contributions[required].isna().any().any():
        raise ValueError("polygrid_contributions: missing values")
    for column in keys + ["period", "possession_id", "start_event_id", "end_event_id"]:
        if not is_integer_dtype(contributions[column]):
            raise ValueError(f"polygrid_contributions: invalid {column}")
    values = contributions[allocations].to_numpy(dtype=float)
    if not np.isfinite(values).all() or (values < 0).any():
        raise ValueError("polygrid_contributions: invalid distance or time")
    if not contributions.cell_id.isin(cells.cell_id).all():
        raise ValueError("polygrid_contributions: unknown cell")
    if contributions.duplicated(["start_event_id", "end_event_id", "cell_id"]).any():
        raise ValueError("polygrid_contributions: duplicate transition/cell")
    lookup = possessions.set_index("possession_id")
    if not contributions.possession_id.isin(lookup.index).all():
        raise ValueError("polygrid_contributions: unknown possession")
    for column in ["game_id", "period", "possession_team_id", "source_dataset"]:
        if (
            not contributions[column]
            .eq(contributions.possession_id.map(lookup[column]))
            .all()
        ):
            raise ValueError(f"polygrid_contributions: {column} mismatch")
    event_lookup = events.set_index("event_id")
    for endpoint in ["start_event_id", "end_event_id"]:
        if not contributions[endpoint].isin(event_lookup.index).all():
            raise ValueError("polygrid_contributions: unknown event")
        if not contributions.possession_id.eq(
            contributions[endpoint].map(event_lookup.possession_id)
        ).all():
            raise ValueError("polygrid_contributions: event possession mismatch")
    if not contributions.start_event_id.lt(contributions.end_event_id).all():
        raise ValueError("polygrid_contributions: invalid event ordering")
    pooled = contributions.groupby(keys)[allocations].sum()
    if not np.isfinite(pooled.to_numpy(dtype=float)).all():
        raise ValueError("polygrid_contributions: non-finite pooled totals")
    rows, cols = cells.grid_row.to_numpy(), cells.grid_column.to_numpy()
    maps = []
    for game in games.itertuples(index=False):
        for team_id in [game.away_team_id, game.home_team_id]:
            index = pd.MultiIndex.from_arrays(
                [
                    np.full(len(cells), game.game_id),
                    np.full(len(cells), team_id),
                    cells.cell_id,
                ],
                names=keys,
            )
            totals = pooled.reindex(index, fill_value=0)
            time = np.zeros((17, 40))
            time[rows, cols] = totals.modeled_elapsed_seconds.to_numpy()
            smooth_time = gaussian_filter(time, sigma=2, mode="constant", truncate=4)
            result = cells[["cell_id"]].copy()
            result["game_id"] = game.game_id
            result["team_id"] = team_id
            result["modeled_elapsed_seconds"] = time[rows, cols]
            for distance, speed in zip(distances, speeds, strict=True):
                image = np.zeros_like(time)
                image[rows, cols] = totals[distance].to_numpy()
                numerator = gaussian_filter(image, sigma=2, mode="constant", truncate=4)
                pace = np.divide(
                    numerator,
                    smooth_time,
                    out=np.full_like(time, np.nan),
                    where=(time > 0) & (smooth_time > 0),
                )
                if np.isinf(pace).any():
                    raise ValueError("game_polygrid: non-finite smoothed pace")
                result[speed] = pace[rows, cols]
            maps.append(result)
    return pd.concat(maps, ignore_index=True)[
        ["game_id", "team_id", "cell_id", "modeled_elapsed_seconds", *speeds]
    ]


def build_game_team_pace(sequences: pd.DataFrame, games: pd.DataFrame) -> pd.DataFrame:
    """Pool all situations by period; derive game totals from those same sums."""
    distances = ["distance_ft", "distance_ew_ft", "distance_ns_ft", "distance_n_ft"]
    speeds = ["speed_total_ft_s", "speed_ew_ft_s", "speed_ns_ft_s", "speed_n_ft_s"]
    allocations = ["modeled_elapsed_seconds", *distances]
    required = [
        "game_id",
        "possession_team_id",
        "period",
        "source_dataset",
        "transitions",
        *allocations,
    ]
    if not set(required).issubset(sequences.columns):
        raise ValueError("pace_sequences: missing summary columns")
    lookup = games.set_index("game_id")
    for column in ["game_id", "possession_team_id", "period", "transitions"]:
        if sequences[column].isna().any() or not is_integer_dtype(sequences[column]):
            raise ValueError(f"pace_sequences: invalid {column}")
    if not sequences.period.gt(0).all() or not sequences.transitions.ge(0).all():
        raise ValueError("pace_sequences: invalid period or transition count")
    if (
        not sequences.game_id.isin(lookup.index).all()
        or not sequences.source_dataset.eq(
            sequences.game_id.map(lookup.source_dataset)
        ).all()
    ):
        raise ValueError("pace_sequences: game/source mismatch")
    if not (
        sequences.possession_team_id.eq(sequences.game_id.map(lookup.home_team_id))
        | sequences.possession_team_id.eq(sequences.game_id.map(lookup.away_team_id))
    ).all():
        raise ValueError("pace_sequences: team is not in game")
    values = sequences[allocations].to_numpy(dtype=float, na_value=np.nan)
    present = ~np.isnan(values)
    if not np.isfinite(values[present]).all() or (values[present] < 0).any():
        raise ValueError("pace_sequences: invalid summary distance or time")
    if sequences.loc[sequences.transitions.gt(0), allocations].isna().any().any():
        raise ValueError("pace_sequences: missing transition allocations")
    work = sequences.copy()
    work.loc[work.transitions.eq(0), allocations] = 0
    keys = ["game_id", "possession_team_id", "period"]
    pooled = work.groupby(keys)[allocations].sum()
    index = []
    for game in games.itertuples(index=False):
        periods = sorted(
            sequences.loc[sequences.game_id.eq(game.game_id), "period"].unique()
        )
        index.extend(
            (game.game_id, team, period)
            for team in [game.away_team_id, game.home_team_id]
            for period in periods
        )
    periods = pooled.reindex(
        pd.MultiIndex.from_tuples(index, names=keys), fill_value=0
    ).reset_index()
    full = periods.groupby(keys[:2])[allocations].sum().reset_index()
    # Even a game without sequences gets a zero-exposure full-game record per team.
    teams = pd.MultiIndex.from_tuples(
        [
            (g.game_id, t)
            for g in games.itertuples(index=False)
            for t in [g.away_team_id, g.home_team_id]
        ],
        names=keys[:2],
    )
    full = full.set_index(keys[:2]).reindex(teams, fill_value=0).reset_index()
    full["period"] = 0
    result = pd.concat([full, periods], ignore_index=True).rename(
        columns={"possession_team_id": "team_id"}
    )
    if not np.isfinite(result[allocations].to_numpy(dtype=float)).all():
        raise ValueError("pace_sequences: non-finite pooled totals")
    denominator = result.modeled_elapsed_seconds.where(
        result.modeled_elapsed_seconds.gt(0)
    )
    for distance, speed in zip(distances, speeds, strict=True):
        result[speed] = result[distance] / denominator
        if np.isinf(result[speed].to_numpy(dtype=float, na_value=np.nan)).any():
            raise ValueError("pace_sequences: non-finite pooled speed")
    return result[["game_id", "team_id", "period", *allocations, *speeds]]


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
    game_team_pace = build_game_team_pace(possessions, games)
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

    cells = pd.read_parquet(PROJECT_ROOT / "data/processed/pace_polygrid_cells.parquet")
    contributions = pd.read_parquet(
        PROJECT_ROOT / "data/processed/pace_polygrid_contributions.parquet"
    )
    game_polygrid = build_game_polygrids(
        cells, contributions, games, possessions, events
    )

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
                connection.executemany(
                    "INSERT INTO polygrid_cells VALUES (?, ?, ?, ?, ?, ?, ?)",
                    cells[
                        [
                            "cell_id",
                            "grid_column",
                            "grid_row",
                            "x_min_ft",
                            "x_max_ft",
                            "y_min_ft",
                            "y_max_ft",
                        ]
                    ].itertuples(index=False, name=None),
                )
                polygrid_rows = game_polygrid.astype(object)
                pace_rows = game_team_pace.astype(object)
                pace_rows = pace_rows.where(pace_rows.notna(), None)
                connection.executemany(
                    "INSERT INTO game_team_pace VALUES "
                    "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    pace_rows.itertuples(index=False, name=None),
                )
                polygrid_rows = polygrid_rows.where(polygrid_rows.notna(), None)
                connection.executemany(
                    "INSERT INTO game_polygrid VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    polygrid_rows.itertuples(index=False, name=None),
                )
            if connection.execute("PRAGMA foreign_key_check").fetchall():
                raise ValueError("Imported database contains invalid references")
            for name, frame in [
                ("teams", teams),
                ("players", players),
                ("games", games),
                ("possessions", possessions),
                ("events", events),
                ("polygrid_cells", cells),
                ("game_polygrid", game_polygrid),
                ("game_team_pace", game_team_pace),
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
        f"{len(events)} events, {len(cells)} polygrid cells, "
        f"{len(game_polygrid)} game polygrid rows, "
        f"{len(game_team_pace)} team pace summaries into {database}"
    )


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sqlite3.Error) as error:
        raise SystemExit(f"Ingestion failed: {error}") from error
