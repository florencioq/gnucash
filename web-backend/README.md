# web-backend

FastAPI backend implementation for the `gnucash-web-spec` scope, including:
- Book CRUD
- Commodity CRUD
- Account CRUD and account tree
- Customer CRUD
- Vendor CRUD
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

Set `DATABASE_URL` for the app before running:

```bash
export DATABASE_URL=postgresql+psycopg://gnucash:gnucash@localhost:5433/gnucash_web
```

This backend also loads `.env` automatically at runtime (keys are applied only if not already set in the environment).

Optional: seed minimum spec data on startup:

```bash
export SEED_ON_STARTUP=true
```

Optional: allow frontend origin(s) for CORS:

```bash
export CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Run

```bash
uvicorn app.main:app --reload
```

## Tests

```bash
pytest -q
```
