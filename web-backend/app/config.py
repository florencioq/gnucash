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


_load_dotenv()


class Settings:
    app_name: str = "GnuCash Web Backend"
    app_version: str = "0.1.0"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./gnucash.db")
    seed_on_startup: bool = _env_bool("SEED_ON_STARTUP", default=False)
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]


settings = Settings()
