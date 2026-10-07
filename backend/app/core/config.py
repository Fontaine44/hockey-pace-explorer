"""Environment-based application settings."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Hockey Pace Explorer API"
    app_env: str = "development"
    database_url: str = "sqlite:///./data/app.db"


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings instance."""
    return Settings()
