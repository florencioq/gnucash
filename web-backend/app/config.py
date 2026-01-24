import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from repo root if present
repo_root = Path(__file__).resolve().parents[2]
env_path = repo_root / ".env"
if env_path.exists():
	load_dotenv(env_path)

# Example: postgresql+asyncpg://user:password@localhost:5432/gnucash_web_cursor
# Default: postgresql+asyncpg://gnucash:gnucash@localhost:5433/gnucash_web_cursor
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://gnucash:gnucash@localhost:5433/gnucash_web_cursor")
