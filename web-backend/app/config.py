from __future__ import annotations

import os


class Settings:
    app_name: str = "GnuCash Web Backend"
    app_version: str = "0.1.0"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./gnucash.db")


settings = Settings()
