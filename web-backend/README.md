# web-backend

FastAPI backend implementation for the `gnucash-web-spec` scope, including:
- Book CRUD
- Commodity CRUD
- Account CRUD and account tree
- Customer CRUD
- Vendor CRUD
- Authentication (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`)
- Transaction posting with split validation (balanced entries)
- Monthly income statement report (DRE) with comparisons, account drill-down and matrix by year-month

## Dependencies

This backend uses a Python dependency manifest at:
- `requirements.txt`

Install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Database (Docker Compose)

Local development expects PostgreSQL via Docker Compose:

```bash
docker compose up -d db
```

To stop:

```bash
docker compose stop db
```

To run backend + frontend + database together from project root:

```bash
cd ..
cp .env.example .env
docker compose up --build
```

Endpoints:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

Set `DATABASE_URL` for the app before running:

```bash
export DATABASE_URL=postgresql+psycopg://gnucash:gnucash@localhost:5433/gnucash_web
```

This backend also loads `.env` automatically at runtime (keys are applied only if not already set in the environment).

You can start from the example env file:

```bash
cp .env.example .env
```

Recommended split:
- `DATABASE_URL`: PostgreSQL for the main app and Alembic migrations
- `DATABASE_URL_TEST`: SQLite for tests (`pytest`)

Optional: seed minimum spec data on startup:

```bash
export SEED_ON_STARTUP=true
```

Optional: allow frontend origin(s) for CORS:

```bash
export CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Authentication settings:

```bash
# recommended for operation: true
export AUTH_REQUIRED=true

# set in production (at least 32 bytes for HS256)
export AUTH_JWT_SECRET=change-this-secret-in-production-min-32-bytes

# optional tuning
export AUTH_ACCESS_TOKEN_TTL_MINUTES=30
export AUTH_REFRESH_TOKEN_TTL_MINUTES=10080
export AUTH_PASSWORD_ITERATIONS=210000
```

Test runs keep `AUTH_REQUIRED=false` in `tests/conftest.py`.

## PostgreSQL Backup

The repository includes `scripts/backup_pg.sh` to create PostgreSQL backups with `pg_dump`.

From project root, run:

```bash
PGHOST=localhost PGPORT=5433 PGUSER=gnucash PGPASSWORD=gnucash ./scripts/backup_pg.sh gnucash_web ./backups
```

This command creates a backup of `gnucash_web` in `./backups`.

## Run

```bash
uvicorn app.main:app --reload
```

## Import from GnuCash PostgreSQL

To migrate `books`, `commodities`, `accounts`, `customers`, `vendors`, `transactions`, `splits`, `lots`, `invoices` and `entries` from a GnuCash PostgreSQL database:

```bash
python scripts/import_gnucash_postgres.py
```

Defaults for source database are:
- host: `localhost`
- port: `5431`
- database: `gnucash`
- user: `gnucash_user`
- password: `gnucash_pass`

The target database uses `DATABASE_URL` from environment or `web-backend/.env`.

If source has multiple books and you also want to import `customers/vendors`, set which target book should receive them:

```bash
python scripts/import_gnucash_postgres.py --business-book-id <book-uuid>
```

You can skip specific entities when needed:

```bash
python scripts/import_gnucash_postgres.py --skip-customers --skip-vendors --skip-transactions --skip-splits --skip-lots --skip-invoices --skip-entries
```

Preview without writing:

```bash
python scripts/import_gnucash_postgres.py --dry-run
```

## Tests

```bash
pytest -q
```
