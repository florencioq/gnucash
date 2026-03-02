# Implementation Profile - FastAPI + React + PostgreSQL

This document is a reference implementation profile and does not override normative rules in
`spec/**`. UX behavioral requirements are in `spec/05-ux/**`.

## Stack

### Backend

- Python 3.12+
- FastAPI
- SQLAlchemy 2.x
- Alembic migrations
- PostgreSQL 16+ (primary runtime target)
- psycopg3

### Frontend

- React
- JavaScript/JSX (TypeScript optional)
- Bootstrap 5

## Recommended conventions

1. IDs SHOULD use UUID textual format.
2. Date/time values MUST be persisted and exposed in UTC.
3. Error payload SHOULD follow `{code, message, details}`.
4. Runtime and migrations SHOULD read `DATABASE_URL`.
5. PostgreSQL SHOULD be the default runtime database for this profile.
6. SQLite MAY be used for lightweight local tests.
7. Invoice/bill auto-number generation for blank IDs SHOULD use atomic server-side reservation
   per `(book_id, owner_type)` (counter row lock or equivalent `upsert-returning` strategy).
8. Authenticated clients SHOULD centralize bearer-token storage/refresh and automatic
   `Authorization` header injection in `src/api/client.js`.
9. Containerized local runtime SHOULD provide a single `docker compose` stack for
   `db` + `web-backend` + `web-frontend`.
10. In containerized runtime, backend startup SHOULD run pending Alembic migrations before
    serving HTTP requests.
11. Frontend container builds SHOULD inject backend base URL via `VITE_API_BASE_URL`.

## Suggested backend folder shape

- `app/models.py`
- `app/schemas.py`
- `app/routes/*.py`
- `app/services/*.py`
- `alembic/versions/*`

## Suggested frontend folder shape

- `src/pages/*.jsx`
- `src/components/*.jsx`
- `src/api/client.js`
- `src/hooks/*.js`

## React implementation notes

These notes are specific to React and complement the technology-agnostic UX requirements in
`spec/05-ux/**`.

- View-to-view synchronization SHOULD use idempotent state setters
  (e.g. `setState((prev) => prev === next ? prev : next)`) to avoid no-op re-render cascades.
- Callback props passed to mounted dynamic/detail tabs SHOULD be referentially stable
  (e.g. `useCallback`) when consumed by effect dependencies.
- Effects that synchronize parent/child state SHOULD guard equivalent payloads before
  dispatching updates to shared navigation state.

## Compliance note

Implementation internals may vary, but observable behavior and invariants from `spec/**` must
remain preserved.
