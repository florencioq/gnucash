from __future__ import annotations

import os


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    app_name: str = "GnuCash Web Backend"
    app_version: str = "0.1.0"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./gnucash.db")
    seed_on_startup: bool = _env_bool("SEED_ON_STARTUP", default=False)


settings = Settings()
