"""FastAPI application entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.app.api.router import api_router
from backend.app.core.config import get_settings
from backend.app.db.base import Base
from backend.app.db.database import engine


class RootResponse(BaseModel):
    """Service metadata returned by the root endpoint."""

    service: str
    version: str
    docs: str


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Initialize database metadata when the application starts."""
    Base.metadata.create_all(bind=engine)
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api")


@app.get("/", response_model=RootResponse)
def root() -> RootResponse:
    """Identify the API and point clients to its documentation."""
    return RootResponse(
        service="hockey-pace-explorer-api",
        version="0.1.0",
        docs="/docs",
    )
