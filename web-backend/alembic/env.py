import os
import sys
from pathlib import Path
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Ensure project root (web-backend) is on sys.path so 'app' imports work
ALembic_dir = Path(__file__).resolve().parent
WEB_BACKEND_ROOT = ALembic_dir.parent  # /.../web-backend
REPO_ROOT = WEB_BACKEND_ROOT.parent    # /.../gnucash

for p in (WEB_BACKEND_ROOT, REPO_ROOT, WEB_BACKEND_ROOT / "app"):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)

# Import metadata from models
from app.models import Base

# Set SQLAlchemy URL from env or app.config
try:
    from app.config import DATABASE_URL
    sqlalchemy_url = DATABASE_URL.replace("+asyncpg", "")  # Alembic uses sync driver
except Exception:
    sqlalchemy_url = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/gnucash_web")

config.set_main_option("sqlalchemy_url", sqlalchemy_url)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy_url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
