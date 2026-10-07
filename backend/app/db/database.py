"""SQLAlchemy engine, session factory, and FastAPI dependency."""

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from backend.app.core.config import PROJECT_ROOT, get_settings


def resolve_database_url(database_url: str) -> str:
    """Resolve relative SQLite paths against the repository root."""
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        return database_url

    raw_path = database_url.removeprefix(prefix)
    database_path = Path(raw_path)
    if database_path.is_absolute():
        return database_url

    resolved_path = (PROJECT_ROOT / database_path).resolve()
    resolved_path.parent.mkdir(parents=True, exist_ok=True)
    return f"{prefix}{resolved_path.as_posix()}"


def create_database_engine() -> Engine:
    """Create an engine using SQLite-specific connection options when needed."""
    database_url = resolve_database_url(get_settings().database_url)
    connect_args = (
        {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    )
    return create_engine(database_url, connect_args=connect_args)


engine = create_database_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session and always close it after the request."""
    with SessionLocal() as session:
        yield session
