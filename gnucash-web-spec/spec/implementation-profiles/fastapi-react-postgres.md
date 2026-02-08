# Implementation Profile - FastAPI + React + PostgreSQL

This document describes a reference implementation. It DOES NOT modify the normative specification in `spec/**`.

## Stack

### Backend

- Python 3.12+
- FastAPI
- SQLAlchemy 2.0 typed ORM
- Alembic migrations
- PostgreSQL 16+
- psycopg3

### Frontend

- React
- Typescript
- Bootstrap 5

## Recommended conventions

1. IDs SHOULD use `uuid4` and be serialized as UUID strings.
2. Date/time values MUST be persisted and exposed in UTC.
3. Error responses SHOULD map integrity exceptions to `400/409` using `code/message/details`.
4. Migrations MUST encode constraints aligned with domain invariants.
5. Backend implementation SHOULD provide a dependency manifest (for example `requirements.txt` or an equivalent lockfile).
6. Local development MUST provide a PostgreSQL service using Docker Compose (or an equivalent container-based setup), and the backend repository SHOULD include a ready-to-run compose file.

## Suggested backend folder shape

- `app/models.py`
- `app/schemas.py`
- `app/routes/books.py`
- `app/routes/commodities.py`
- `app/routes/accounts.py`
- `app/services/`
- `app/repositories/`
- `alembic/versions/`

## Suggested frontend folder shape

- `src/pages/BooksPage.jsx`
- `src/pages/CommoditiesPage.jsx`
- `src/pages/AccountsPage.jsx`
- `src/components/AccountTree.jsx`
- `src/api/client.js`

## Compliance note

Implementation internals MAY differ, but observable behavior and invariants defined in the spec MUST be preserved.
