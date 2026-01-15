# GnuCash Web Backend

This is a minimal FastAPI + SQLAlchemy backend scaffold to support core accounting entities.

Environment
- DATABASE_URL (default: postgresql+asyncpg://user:password@localhost:5432/gnucash_web)

Quick start
1. Create virtualenv and install deps: see requirements.txt
2. Configure DATABASE_URL
3. Run Alembic migrations to create tables
4. Start API: uvicorn app.main:app --reload

Tables in initial migration
- books
- commodities
- accounts
