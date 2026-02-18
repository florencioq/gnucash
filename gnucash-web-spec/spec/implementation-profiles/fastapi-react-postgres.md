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
7. Invoice/bill auto-number generation for blank IDs SHOULD use atomic server-side reservation per `(book_id, owner_type)` (counter row lock or equivalent `upsert-returning` strategy).

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
- Invoicing entry editor should start with no revenue account selected; user must choose `income_account_guid` explicitly.
- Purchasing entry editor should start with no expense account selected; user must choose `income_account_guid` explicitly.
- `Nova Fatura` and `Nova Compra` detail tabs should open with clean state and must not render stale header/line data from previously selected documents.
- Revenue/expense account selectors in entry editors should prioritize leaf-first path labels (`account / parent / ...`) and provide wider input columns to keep leaf names visible.
- Payment account selection should use hierarchical account pickers.
- Hierarchical account pickers should provide a tall viewport to improve deep-tree navigation.
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
- Dynamic detail tab labels should prefer business document numbers (invoice/bill id) when available, with GUID fallback only when needed.
- Deleting invoice/bill documents should require explicit user confirmation and close the corresponding dynamic detail tab after successful deletion.
- Ledger transaction grid should support pagination controls (first/previous/next/last + page size options) to keep navigation responsive.
- Ledger transaction grid should default to newest-first chronological order and allow switching to oldest-first.
- Ledger pagination default page size should be 10 items.
- Ledger rows linked to invoice/bill workflows should not allow edit/delete actions; users should perform those operations in `Faturamentos` or `Compras`.

## Compliance note

Implementation internals may vary, but observable behavior and invariants from `spec/**` must remain preserved.
