# web-backend

FastAPI backend implementation for the `gnucash-web-spec` MVP scope.

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

Optional: seed minimum spec data on startup:

```bash
export SEED_ON_STARTUP=true
```

## Run

```bash
uvicorn app.main:app --reload
```

## Tests

```bash
pytest -q
```
