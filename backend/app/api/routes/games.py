"""Games available for review."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
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
    return [dict(row) for row in rows.mappings()]
