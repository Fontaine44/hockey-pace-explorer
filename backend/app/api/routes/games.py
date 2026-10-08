"""Games available for review."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.db.database import get_db

router = APIRouter()


class GameResponse(BaseModel):
    game_id: int
    game_date: date
    home_team_id: int
    away_team_id: int
    home_team_name: str
    away_team_name: str
    source_dataset: str
    periods: list[int]


class PossessionResponse(BaseModel):
    possession_id: int
    game_id: int
    period: int
    possession_team_id: int
    team_name: str
    start_event_id: int
    end_event_id: int
    start_clock_seconds: float
    end_clock_seconds: float
    event_count: int
    elapsed_seconds: float
    modeled_elapsed_seconds: float
    speed_total_ft_s: float
    pace_status: str
    outcome: str
    home_score: int
    away_score: int
    home_skaters: int
    away_skaters: int
    contains_goal: bool


class PossessionEventResponse(BaseModel):
    event_id: int
    event: str
    x: float | None
    y: float | None
    clock_seconds: float
    team_id: int
    player_name: str


@router.get("/games", response_model=list[GameResponse])
def get_games(
    source_dataset: Annotated[str, Query(min_length=1)],
    db: Annotated[Session, Depends(get_db)],
):
    rows = db.execute(
        text("""
            SELECT g.game_id, g.game_date, g.home_team_id, g.away_team_id,
                   home.team_name AS home_team_name,
                   away.team_name AS away_team_name, g.source_dataset
            FROM games AS g
            JOIN teams AS home ON home.team_id = g.home_team_id
            JOIN teams AS away ON away.team_id = g.away_team_id
            WHERE g.source_dataset = :source_dataset
            ORDER BY g.game_date, g.game_id
        """),
        {"source_dataset": source_dataset},
    )
    games = [dict(row) for row in rows.mappings()]
    periods = db.execute(
        text("""
        SELECT DISTINCT p.game_id, p.period FROM possessions AS p
        JOIN games AS g ON g.game_id = p.game_id
        WHERE g.source_dataset = :source_dataset
        ORDER BY p.period
    """),
        {"source_dataset": source_dataset},
    ).all()
    for game in games:
        game["periods"] = [
            period for game_id, period in periods if game_id == game["game_id"]
        ]
    return games


@router.get("/games/{game_id}/possessions", response_model=list[PossessionResponse])
def get_possessions(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
    period: Annotated[int | None, Query(ge=1)] = None,
):
    if not db.execute(
        text("SELECT 1 FROM games WHERE game_id = :id"), {"id": game_id}
    ).first():
        raise HTTPException(status_code=404, detail="Game not found")
    rows = db.execute(
        text("""
        SELECT p.possession_id, p.game_id, p.period, p.possession_team_id,
               t.team_name, p.start_event_id, p.end_event_id,
               p.start_clock_seconds, p.end_clock_seconds, p.event_count,
               COALESCE(p.elapsed_seconds, 0) AS elapsed_seconds,
               COALESCE(p.modeled_elapsed_seconds, 0) AS modeled_elapsed_seconds,
               COALESCE(p.speed_total_ft_s, 0) AS speed_total_ft_s,
               p.pace_status, p.outcome,
               p.home_score, p.away_score, p.home_skaters, p.away_skaters,
               p.contains_goal
        FROM possessions AS p
        JOIN teams AS t ON t.team_id = p.possession_team_id
        WHERE p.game_id = :game_id AND (:period IS NULL OR p.period = :period)
        ORDER BY p.start_event_id
    """),
        {"game_id": game_id, "period": period},
    )
    return [dict(row) for row in rows.mappings()]


@router.get(
    "/games/{game_id}/possessions/{possession_id}/events",
    response_model=list[PossessionEventResponse],
)
def get_possession_events(
    game_id: int,
    possession_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    if not db.execute(
        text("""
            SELECT 1 FROM possessions
            WHERE game_id = :game_id AND possession_id = :possession_id
        """),
        {"game_id": game_id, "possession_id": possession_id},
    ).first():
        raise HTTPException(
            status_code=404, detail="Possession not found for this game"
        )
    rows = db.execute(
        text("""
            SELECT e.event_id, e.event, e.x, e.y, e.clock_seconds,
                   e.team_id, p.player_name
            FROM events AS e
            JOIN players AS p ON p.player_id = e.player_id
            WHERE e.game_id = :game_id AND e.possession_id = :possession_id
            ORDER BY e.event_id
        """),
        {"game_id": game_id, "possession_id": possession_id},
    )
    return [dict(row) for row in rows.mappings()]
