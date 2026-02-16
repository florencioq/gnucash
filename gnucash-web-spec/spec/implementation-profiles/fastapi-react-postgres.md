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
7. The runtime and Alembic migrations SHOULD read `DATABASE_URL` and it MUST point to PostgreSQL for this profile.
8. SQLite MAY be used only for lightweight local testing, but it is non-conformant with this profile and SHOULD NOT be the default configuration.

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
- `src/pages/LedgerPage.jsx`
- `src/components/AccountTree.jsx`
- `src/api/client.js`

## UX guidance

- The account tree view SHOULD be the primary UI for managing accounts.
- The account tree SHOULD support expand/collapse for nested account navigation.
- Account tree rows SHOULD surface account `code` (when present) and current balance formatted with commodity mnemonic.
- Flat account lists MAY be omitted if the tree view provides editing and deletion affordances.
- Account editing SHOULD allow toggling `is_placeholder` in addition to updating the name.
- Ledger UI SHOULD allow editing existing postings by reusing `PATCH /transactions/{tx_guid}`.
- Account creation SHOULD use a hierarchical parent selector (tree picker) instead of a flat parent dropdown.
- Parent/picking selectors SHOULD hide synthetic `ROOT` nodes and present only actionable descendants.
- When a parent account is selected in account creation, UI SHOULD auto-set the new account `type` to the parent `type` (except when parent is `ROOT`).
- UI account path labels in selectors SHOULD omit the synthetic `ROOT` prefix (for example show `Assets / Bank` instead of `Root / Assets / Bank`).

## Compliance note

Implementation internals MAY differ, but observable behavior and invariants defined in the spec MUST be preserved.
