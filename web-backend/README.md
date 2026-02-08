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

## Run

```bash
uvicorn app.main:app --reload
```

## Tests

```bash
pytest -q
```
