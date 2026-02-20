from __future__ import annotations

import os
from pathlib import Path


def _load_dotenv() -> None:
    project_root = Path(__file__).resolve().parents[1]
    env_path = project_root / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"").strip("'")
        os.environ.setdefault(key, value)


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value.strip())
    except (TypeError, ValueError):
        return default


_load_dotenv()


class Settings:
    app_name: str = "IgeosCash Backend"
    app_version: str = "0.1.0"
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://gnucash:gnucash@localhost:5433/gnucash_web",
    )
    seed_on_startup: bool = _env_bool("SEED_ON_STARTUP", default=False)
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]
    auth_required: bool = _env_bool("AUTH_REQUIRED", default=False)
    auth_jwt_secret: str = os.getenv(
        "AUTH_JWT_SECRET",
        "change-this-secret-in-production-min-32-bytes",
    )
    auth_access_token_ttl_minutes: int = max(1, _env_int("AUTH_ACCESS_TOKEN_TTL_MINUTES", default=30))
    auth_refresh_token_ttl_minutes: int = max(1, _env_int("AUTH_REFRESH_TOKEN_TTL_MINUTES", default=60 * 24 * 7))
    auth_password_iterations: int = max(100_000, _env_int("AUTH_PASSWORD_ITERATIONS", default=210_000))


settings = Settings()
