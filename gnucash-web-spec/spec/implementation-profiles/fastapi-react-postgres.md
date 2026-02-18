# Implementation Profile - FastAPI + React + PostgreSQL

This document is a reference implementation profile and does not override normative rules in `spec/**`.

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

## UX guidance

- Account tree should be primary for account navigation.
- Tree selectors should hide synthetic `ROOT` where user must choose actionable accounts.
- Books UI should expose active-book selection.
- Operational forms should consume active book context.
- Invoicing and purchasing pages should use wider layout for dense editing.
- Invoicing must expose explicit post/unpost and payment undo actions.
- Posted invoice/bill should lock line mutations until unposted.
- Payment account selection should use hierarchical account pickers.
- Invoicing navigation should be split into list (`Faturamentos`) and detail (`Fatura`).
- Purchasing navigation should be split into list (`Compras`) and detail (`Compra`).
- List views should support filtering, sortable columns, and open-to-detail actions.
- "Novo" actions (`Nova Fatura` / `Nova Compra`) should be initiated from list views, not from detail views.
- List fallback labels should be explicit for missing owner references (`cliente não encontrado` / `fornecedor não encontrado`).
- Invoicing and purchasing lists should use server-side pagination (`/invoices/list`, `/bills/list`) with filtering and sorting parameters.
- Invoicing and purchasing lists should persist filter/sort/page state when user switches tabs and after browser refresh within the same session.
- Invoicing and purchasing pagination controls should include first/previous/next/last navigation and configurable page size options.
- Detail screens should open as dynamic, closable tabs when launched from list actions.
- Dynamic detail tabs should persist after browser refresh within the same session.

## Compliance note

Implementation internals may vary, but observable behavior and invariants from `spec/**` must remain preserved.
