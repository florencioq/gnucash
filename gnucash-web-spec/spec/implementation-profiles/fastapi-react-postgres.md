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
8. Authenticated clients SHOULD centralize bearer-token storage/refresh and automatic `Authorization` header injection in `src/api/client.js`.
9. Containerized local runtime SHOULD provide a single `docker compose` stack for `db` + `web-backend` + `web-frontend`.
10. In containerized runtime, backend startup SHOULD run pending Alembic migrations before serving HTTP requests.
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

## UX guidance

- Primary application navigation SHOULD prefer grouped sections over a flat list of many same-level tabs.
- Suggested primary navigation layout is a left sidebar with section headers and nested items.
- Suggested section and icon mapping (Bootstrap Icons names):
  - `Operações` (`bi-receipt-cutoff`)
    - `Faturamentos` (`bi-file-earmark-text`)
    - `Compras` (`bi-file-earmark-ruled`)
    - `Contas a Receber` (`bi-cash-stack`)
    - `Contas a Pagar` (`bi-wallet2`)
  - `Contábil` (`bi-journal-text`)
    - `Razão` (`bi-journal-bookmark`)
  - `Relatórios` (`bi-bar-chart-line`)
    - `DRE Mensal` (`bi-graph-up-arrow`)
    - `Prazo Quitação` (`bi-hourglass-split`)
  - `Cadastros` (`bi-collection`)
    - `Livros` (`bi-book`)
    - `Moedas` (`bi-currency-exchange`)
    - `Contas` (`bi-diagram-3`)
    - `Clientes` (`bi-people`)
    - `Fornecedores` (`bi-truck`)
  - `Administração` (`bi-gear`)
    - `Usuários` (`bi-person-badge`) (superuser only)
- Suggested section ordering SHOULD be: `Operações`, `Contábil`, `Relatórios`, `Cadastros`, `Administração`.
- Sidebar navigation SHOULD support collapsed mode with icon-only actions that remain fully clickable.
- Sidebar collapsed mode SHOULD keep feature parity (navigation behavior must be identical to expanded mode).
- Dynamic document tabs (`Fatura <id>`, `Compra <id>`) SHOULD remain closable and SHOULD render in a secondary row/panel, separate from primary sidebar navigation.
- Sidebar entries for `DRE Mensal`, `Razão`, `Faturamentos`, `Compras`, `Contas a Receber`, and `Contas a Pagar` SHOULD open/focus dynamic tabs in the secondary row/panel and SHOULD NOT implicitly close other open dynamic tabs.
- Navigating from a dynamic detail tab back to its list (`Faturamentos`/`Compras`) SHOULD close the originating dynamic tab to avoid stale "Novo ..." tabs lingering in list context.
- Account tree should be primary for account navigation.
- Account master create/edit actions SHOULD open in modal dialogs instead of inline tree-adjacent forms.
- Account master tree screen SHOULD provide name-based search/filter over the rendered hierarchy.
- Account tree balances SHOULD be rendered as hierarchical totals in the UI (parent balance aggregated from descendants; placeholder nodes aggregate children).
- Account tree rows SHOULD use a dedicated right-aligned balance column and subtle row separators so balance/actions remain visually associated with the corresponding account.
- Account tree container width SHOULD be constrained to avoid excessive horizontal spread between account labels and row actions.
- Tree selectors should hide synthetic `ROOT` where user must choose actionable accounts.
- Books UI should expose active-book selection.
- Books UI SHOULD expose setup account selectors backed by hierarchical account trees for:
  - default payables account (`default_payables_account_guid`)
  - default receivables account (`default_receivables_account_guid`)
  - default ISS recoverable account (`default_iss_recoverable_account_guid`)
- Frontend should include login screen and protected navigation guard for business routes.
- Frontend should include user administration screen for superusers (create users and manage per-book access roles).
- User administration screen should list existing per-book grants for each non-superuser and allow:
  - create/update a grant with role `VIEWER` or `EDITOR`
  - revoke a grant for a selected `(user, book)` pair
- Operational forms should consume active book context.
- Invoicing and purchasing pages should use wider layout for dense editing.
- Invoicing must expose explicit post/unpost and payment undo actions.
- Posted invoice/bill should lock line mutations until unposted.
- Invoicing entry editor should start with no revenue account selected; user must choose `income_account_guid` explicitly.
- Purchasing entry editor should start with no expense account selected; user must choose `income_account_guid` explicitly.
- Customer and vendor master forms SHOULD expose default account selectors using hierarchical account trees.
- Customer and vendor master create/edit actions SHOULD open in modal dialogs instead of inline table-adjacent forms.
- Vendor master list SHOULD provide name search, active/inactive status filter, sortable name column, and UI pagination controls.
- Invoicing entry forms SHOULD auto-suggest customer default revenue account when available.
- Purchasing entry forms SHOULD auto-suggest vendor default expense account when available.
- Invoicing posting form SHOULD auto-suggest book default receivables account when available.
- Invoicing posting form SHOULD auto-suggest book default ISS recoverable account when retained tax is present.
- Invoicing and purchasing posting forms SHOULD expose editable due-date inputs, defaulting to posting date.
- Invoicing line editor SHOULD treat tax amount as informational/included value while retained-at-source behavior is resolved during posting/open-balance calculation.
- `Nova Fatura` and `Nova Compra` detail tabs should open with clean state and must not render stale header/line data from previously selected documents.
- Revenue/expense account selectors in entry editors should prioritize leaf-first path labels (`account / parent / ...`) and provide wider input columns to keep leaf names visible.
- Payment account selection should use hierarchical account pickers.
- In `Compras`, the payment form SHOULD auto-suggest the payment account from the most recent prior payment of the same vendor (when a valid account is available and differs from the bill posting account).
- Hierarchical account pickers should provide a tall viewport to improve deep-tree navigation.
- Invoicing navigation should be split into list (`Faturamentos`) and detail (`Fatura`).
- Purchasing navigation should be split into list (`Compras`) and detail (`Compra`).
- List views should support filtering, sortable columns, and open-to-detail actions.
- "Novo" actions (`Nova Fatura` / `Nova Compra`) should be initiated from list views, not from detail views.
- List fallback labels should be explicit for missing owner references (`cliente não encontrado` / `fornecedor não encontrado`).
- Invoicing and purchasing lists should use server-side pagination (`/invoices/list`, `/bills/list`) with filtering and sorting parameters.
- Invoicing and purchasing list/open-items grids SHOULD render a `Vencimento` (`date_due`) column and allow sort by due date.
- "Contas a Receber" screen should consume `/invoices/list` with `posted_filter=POSTED` and `payment_filter=OPEN`, exposing direct navigation links to each faturamento.
- "Contas a Pagar" screen should consume `/bills/list` with `posted_filter=POSTED` and `payment_filter=OPEN`, exposing direct navigation links to each compra.
- "Prazo Quitação" report screen SHOULD consume `/reports/invoices/settlement-by-customer` with server-side filtering/sorting/pagination.
- In the monthly DRE matrix table, `Resultado Líquido` SHOULD be rendered as the first row, above `Receita` and `Despesa`.
- Invoicing and purchasing lists should persist filter/sort/page state when user switches tabs and after browser refresh within the same session.
- Invoicing and purchasing pagination controls should include first/previous/next/last navigation and configurable page size options.
- Detail screens should open as dynamic, closable tabs when launched from list actions.
- Dynamic detail tabs should persist after browser refresh within the same session.
- Open dynamic tabs SHOULD preserve mounted UI state/context while the session remains active (for example filters, current form context, and local view state) when switching between tabs.
- React view-to-view synchronization SHOULD use idempotent state setters (for example `setState((prev) => prev === next ? prev : next)` when applicable) to avoid no-op re-render cascades.
- Callback props passed to mounted dynamic/detail tabs SHOULD be referentially stable (for example `useCallback`) when consumed by effect dependencies.
- Effects that synchronize parent/child state SHOULD guard equivalent payloads before dispatching updates to shared navigation state.
- Repeated open/focus commands for the same tab and same context SHOULD be treated as no-op updates.
- Dynamic detail tab labels should prefer business document numbers (invoice/bill id) when available, with GUID fallback only when needed.
- Deleting invoice/bill documents should require explicit user confirmation and close the corresponding dynamic detail tab after successful deletion.
- Ledger transaction grid should support pagination controls (first/previous/next/last + page size options) to keep navigation responsive.
- Ledger transaction grid should default to newest-first chronological order and allow switching to oldest-first.
- Ledger pagination default page size should be 10 items.
- Ledger transaction grid SHOULD expose clickable `Contra-partida` account links that switch the current `Razão` view directly to the selected counterparty account.
- Ledger selected account context SHOULD be persisted in-session so browser refresh restores the most recently selected account (including account changes performed via counterparty links).
- Ledger transaction grid amount headers SHOULD use `Saque` and `Depósito`.
- Ledger rows linked to invoice/bill workflows should not allow edit/delete actions; users should perform those operations in `Faturamentos` or `Compras`.
- `Razão`, `Faturamentos`, `Compras`, `Contas a Receber`, and `Contas a Pagar` screens SHOULD expose an explicit `Atualizar` action to force data refresh on demand.
- Monthly DRE matrix period headers SHOULD render date ranges using `a` between start and end dates (for example `01/02/2026` and `a 28/02/2026`).

## Compliance note

Implementation internals may vary, but observable behavior and invariants from `spec/**` must remain preserved.
