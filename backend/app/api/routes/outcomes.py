"""Precomputed outcomes across pooled 5v5 pace quartiles."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.db.database import get_db

router = APIRouter(prefix="/outcomes", tags=["outcomes"])


class QuartileOutcomeResponse(BaseModel):
    quartile: int
    games: int
    median_pace_ft_s: float | None
    lower_pace_ft_s: float
    upper_pace_ft_s: float


class OzRecoveryOutcomeResponse(QuartileOutcomeResponse):
    possessions: int
    shot_possessions: int
    median_time_to_shot_seconds: float | None
    shot_pct: float | None


class EntryTypeOutcomeResponse(QuartileOutcomeResponse):
    entries: int
    controlled_entries: int
    dumped_entries: int
    controlled_entry_pct: float | None
    dumped_entry_pct: float | None


class DumpInOutcomeResponse(QuartileOutcomeResponse):
    dump_ins: int
    team_recoveries: int
    no_team_recovery: int
    unresolved: int
    team_recovery_pct: float | None
    no_team_recovery_pct: float | None
    unresolved_pct: float | None


@router.get("/oz-recoveries", response_model=list[OzRecoveryOutcomeResponse])
def get_oz_recovery_outcomes(db: Annotated[Session, Depends(get_db)]):
    rows = db.execute(text("""
        SELECT quartile, possessions, shot_possessions, games, median_pace_ft_s,
               median_time_to_shot_seconds, shot_pct, lower_pace_ft_s, upper_pace_ft_s
        FROM oz_recovery_outcomes ORDER BY quartile
    """))
    return [dict(row) for row in rows.mappings()]


@router.get("/entry-types", response_model=list[EntryTypeOutcomeResponse])
def get_entry_type_outcomes(db: Annotated[Session, Depends(get_db)]):
    rows = db.execute(text("""
        SELECT quartile, entries, controlled_entries, dumped_entries, games,
               median_pace_ft_s, controlled_entry_pct, dumped_entry_pct,
               lower_pace_ft_s, upper_pace_ft_s
        FROM entry_type_outcomes ORDER BY quartile
    """))
    return [dict(row) for row in rows.mappings()]


@router.get("/dump-ins", response_model=list[DumpInOutcomeResponse])
def get_dump_in_outcomes(db: Annotated[Session, Depends(get_db)]):
    rows = db.execute(text("""
        SELECT quartile, dump_ins, team_recoveries, no_team_recovery, unresolved,
               games, median_pace_ft_s, team_recovery_pct, no_team_recovery_pct,
               unresolved_pct, lower_pace_ft_s, upper_pace_ft_s
        FROM dump_in_outcomes ORDER BY quartile
    """))
    return [dict(row) for row in rows.mappings()]


class ShotOutcomeResponse(BaseModel):
    quartile: int
    attempts: int
    on_net_attempts: int
    games: int
    median_pace_ft_s: float | None
    mean_distance_ft: float | None
    distance_attempts: int
    on_net_pct: float | None
    lower_pace_ft_s: float
    upper_pace_ft_s: float


@router.get("/shots", response_model=list[ShotOutcomeResponse])
def get_shot_outcomes(db: Annotated[Session, Depends(get_db)]):
    rows = db.execute(text("""
        SELECT quartile, attempts, on_net_attempts, games, median_pace_ft_s,
               mean_distance_ft, distance_attempts, on_net_pct,
               lower_pace_ft_s, upper_pace_ft_s
        FROM shot_outcomes ORDER BY quartile
    """))
    return [dict(row) for row in rows.mappings()]


class PassOutcomeResponse(BaseModel):
    pass_type: Literal["Direct", "Indirect"]
    quartile: int
    attempts: int
    completed: int
    games: int
    median_pace_ft_s: float | None
    completion_pct: float | None
    lower_pace_ft_s: float
    upper_pace_ft_s: float


@router.get("/passes", response_model=list[PassOutcomeResponse])
def get_pass_outcomes(db: Annotated[Session, Depends(get_db)]):
    rows = db.execute(text("""
        SELECT pass_type, quartile, attempts, completed, games,
               median_pace_ft_s, completion_pct, lower_pace_ft_s, upper_pace_ft_s
        FROM pass_outcomes ORDER BY pass_type, quartile
    """))
    return [dict(row) for row in rows.mappings()]


class EntryOutcomeResponse(BaseModel):
    entry_type: Literal["Carried", "Played"]
    quartile: int
    entries: int
    successes: int
    games: int
    median_pace_ft_s: float | None
    shot_pct: float | None
    lower_pace_ft_s: float
    upper_pace_ft_s: float


@router.get("/entries", response_model=list[EntryOutcomeResponse])
def get_entry_outcomes(db: Annotated[Session, Depends(get_db)]):
    rows = db.execute(text("""
        SELECT entry_type, quartile, entries, successes, games,
               median_pace_ft_s, shot_pct, lower_pace_ft_s, upper_pace_ft_s
        FROM entry_outcomes ORDER BY entry_type, quartile
    """))
    return [dict(row) for row in rows.mappings()]
