# GnuCash Web Backend

This is a minimal FastAPI + SQLAlchemy backend scaffold to support core accounting entities.

Environment
- DATABASE_URL (default: postgresql+asyncpg://gnucash:gnucash@localhost:5433/gnucash_web)

Quick start
1. Create virtualenv and install deps
	- python -m venv .venv && source .venv/bin/activate
	- pip install -r requirements.txt
2. Configure DATABASE_URL (Compose publishes Postgres on 5433)
	- See repo .env or set manually
3. Run Alembic migrations to create tables
	- alembic upgrade head
4. Start API
	- uvicorn app.main:app --reload

Tables in initial migration
- books
- commodities
- accounts

Endpoints
- /health
- /books [POST, GET] /books/{id} [GET]
- /commodities [POST, GET] /commodities/{id} [GET]
- /accounts [POST, GET]
- /accounts/{id} [GET, PATCH, DELETE]
- /accounts/{id}/move [POST]
- /accounts/tree?book_id=... [GET]
