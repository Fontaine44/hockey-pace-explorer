"""Top-level API router."""

from fastapi import APIRouter

from backend.app.api.routes import games, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(games.router)
