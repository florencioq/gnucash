# 04 - Endpoints (Human Guide)

## General behavior

- IDs are UUID strings.
- Timestamps use RFC3339 UTC (`...Z`).
- Error payload format: `code`, `message`, `details`.
- Validation/invariant failures are returned as `400` or `409` by application handlers.
- Runtime-generated OpenAPI may still list `422` defaults from FastAPI metadata.
- When `AUTH_REQUIRED=true`, all business routers (`/books`, `/commodities`, `/accounts`, `/transactions`, `/customers`, `/vendors`, `/invoices`, `/bills`, `/reports`) require `Authorization: Bearer <access_token>`.
- Authorization model combines:
  - global privilege: `is_superuser`
  - per-book grant: `VIEWER` or `EDITOR` via `user_book_access`

## Health

- `GET /health`: service liveness (`{"status":"ok"}`).

## Authentication

- `POST /auth/register`: create user with `email`, `password`, optional `full_name`, optional `is_superuser`.
  - bootstrap behavior: if no user exists yet, request may be unauthenticated and created user is forced to superuser.
  - after bootstrap: requires authenticated superuser.
- `POST /auth/login`: returns `access_token`, `refresh_token`, `token_type`, `expires_in`.
- `POST /auth/refresh`: exchange valid refresh token for a new token pair.
- `GET /auth/me`: returns current authenticated user (requires valid bearer access token).
- `GET /auth/users`: list users (superuser only).
- `GET /auth/users/{user_id}/books`: list user book grants (superuser only).
- `PUT /auth/users/{user_id}/books/{book_id}`: create/update book grant with role `VIEWER|EDITOR` (superuser only).
- `DELETE /auth/users/{user_id}/books/{book_id}`: remove book grant (superuser only).

## Authorization behavior by resource

- Superuser:
  - full read/write across books.
  - required for book/commodity mutations and user management endpoints.
- Non-superuser:
  - read operations for a target `book_id` require grant `VIEWER` or `EDITOR`.
  - write operations for a target `book_id` require grant `EDITOR`.
  - operations against unauthorized books return `403 FORBIDDEN_BOOK`.

## Books

- `POST /books`: create book (`is_active` optional, superuser only).
  - supports optional setup account fields: `default_payables_account_guid`, `default_receivables_account_guid`, `default_iss_recoverable_account_guid`.
- `GET /books`: list books (active first; filtered to accessible books for non-superusers).
- `GET /books/active`: get active book within caller visibility.
- `GET /books/{book_id}`: get by id (requires book read access for non-superusers).
- `PATCH /books/{book_id}`: patch `name`/`is_active` and setup account fields (superuser only).
  - setup validations enforce same-book account, expected type (`LIABILITY` for payables; `ASSET` for receivables/ISS recoverable), non-placeholder, and `default_iss_recoverable_account_guid != default_receivables_account_guid`.
- `DELETE /books/{book_id}`: delete when no linked accounts, invoices/bills, customers, vendors, or user access grants (superuser only).

## Commodities

- `POST /commodities` (superuser only)
- `GET /commodities?namespace=`
- `GET /commodities/{commodity_id}`
- `PATCH /commodities/{commodity_id}` (superuser only)
- `DELETE /commodities/{commodity_id}` (superuser only; blocked while referenced by accounts, customers, vendors, invoices/bills, transactions).

## Accounts

- `POST /accounts`
- `GET /accounts?book_id=`
- `GET /accounts/tree?book_id=` (includes `code`, `balance_num`, `balance_denom`, recursive children ordered by name).
- `GET /accounts/{account_id}`
- `PATCH /accounts/{account_id}` (cycle and same-book parent rules enforced).
- `DELETE /accounts/{account_id}` (blocked when has children/splits/invoice entries).

## Customers

- `POST /customers`
- `GET /customers?book_id=`
- `GET /customers/{customer_guid}`
- `PATCH /customers/{customer_guid}`
- `DELETE /customers/{customer_guid}` (blocked while referenced by customer invoices).
- `income_account_guid` is optional and, when set, must be same-book `INCOME` and non-placeholder.

## Vendors

- `POST /vendors`
- `GET /vendors?book_id=`
- `GET /vendors/{vendor_guid}`
- `PATCH /vendors/{vendor_guid}`
- `DELETE /vendors/{vendor_guid}` (blocked while referenced by vendor bills).
- `expense_account_guid` is optional and, when set, must be same-book `EXPENSE` and non-placeholder.

## Invoices (customer flow)

- `POST /invoices`
- `GET /invoices?book_id=&customer_guid=`
- `GET /invoices/list?book_id=&customer_guid=&posted_filter=&payment_filter=&posted_start_date=&posted_end_date=&due_start_date=&due_end_date=&sort_key=&sort_direction=&page=&page_size=`
  - paginated summary list for invoicing listing screens.
  - supports server-side filtering and sorting.
  - `payment_filter=OPEN` returns only documents with non-zero open amount.
  - `due_start_date`/`due_end_date` filter by computed due date (`date_due`).
  - `sort_key` supports `date_due`.
  - returns `{items, page, page_size, total_items, total_pages}`.
- `GET /invoices/{invoice_guid}`
- `PATCH /invoices/{invoice_guid}`
  - `date_posted` is read-only.
  - structural fields are blocked while posted.
- `DELETE /invoices/{invoice_guid}` (blocked while posted).

Entries:
- `POST /invoices/{invoice_guid}/entries`
- `PATCH /invoices/{invoice_guid}/entries/{entry_guid}`
- `DELETE /invoices/{invoice_guid}/entries/{entry_guid}`
- entry mutations blocked while posted.

Posting:
- `POST /invoices/{invoice_guid}/post`
  - requires at least one entry and non-zero total.
  - accepts optional `due_date`; when omitted, defaults to `post_date`.
  - response exposes computed `date_due`.
  - post account must be same-book `ASSET`, non-placeholder, commodity-compatible.
  - when invoice has retained-at-source tax amount, `retained_tax_account_guid` is required.
  - retained tax account must be same-book `ASSET`, non-placeholder, commodity-compatible, and different from post account.
  - retained-at-source tax reduces receivable open amount at posting time, so initial status may be `PARTIAL`.
- `POST /invoices/{invoice_guid}/unpost`
  - blocked if payment splits exist in posting lot.
  - clears `date_due` (posting transaction and due-date slot are removed).

Payments:
- `POST /invoices/{invoice_guid}/payments`
  - partial payments allowed.
  - amount must be positive and <= open balance.
- `POST /invoices/{invoice_guid}/payments/{payment_tx_guid}/undo`
  - posting tx cannot be undone via this endpoint.

## Bills (vendor purchase flow)

- `POST /bills`
- `GET /bills?book_id=&vendor_guid=`
- `GET /bills/list?book_id=&vendor_guid=&posted_filter=&payment_filter=&posted_start_date=&posted_end_date=&due_start_date=&due_end_date=&sort_key=&sort_direction=&page=&page_size=`
  - paginated summary list for purchase listing screens.
  - supports server-side filtering and sorting.
  - `payment_filter=OPEN` returns only documents with non-zero open amount.
  - `due_start_date`/`due_end_date` filter by computed due date (`date_due`).
  - `sort_key` supports `date_due`.
  - returns `{items, page, page_size, total_items, total_pages}`.
- `GET /bills/{bill_guid}`
- `PATCH /bills/{bill_guid}`
  - `date_posted` is read-only.
  - structural fields are blocked while posted.
- `DELETE /bills/{bill_guid}` (blocked while posted).

Entries:
- `POST /bills/{bill_guid}/entries`
  - account must be `EXPENSE` in same book.
- `PATCH /bills/{bill_guid}/entries/{entry_guid}`
- `DELETE /bills/{bill_guid}/entries/{entry_guid}`
- entry mutations blocked while posted.

Posting:
- `POST /bills/{bill_guid}/post`
  - requires at least one entry and non-zero total.
  - accepts optional `due_date`; when omitted, defaults to `post_date`.
  - response exposes computed `date_due`.
  - post account must be same-book `LIABILITY`, non-placeholder, commodity-compatible.
- `POST /bills/{bill_guid}/unpost`
  - blocked if payment splits exist in posting lot.
  - clears `date_due` (posting transaction and due-date slot are removed).

Payments:
- `POST /bills/{bill_guid}/payments`
  - partial payments allowed.
  - amount must be positive and <= open balance.
- `POST /bills/{bill_guid}/payments/{payment_tx_guid}/undo`
  - posting tx cannot be undone via this endpoint.

## Transactions and splits

- `POST /transactions`: create balanced transaction with >=2 splits.
- `GET /transactions?book_id=`
- `GET /transactions/{tx_guid}`
- `PATCH /transactions/{tx_guid}`: optionally replace splits (same validations as create).
- `DELETE /transactions/{tx_guid}`: deletes transaction + splits.

Protection rule:
- patch/delete MUST be rejected when transaction is linked to invoice/bill posting/payment flow.

## Reports

- `GET /reports/income-statement?book_id=&month=YYYY-MM`
- `GET /reports/income-statement/matrix?book_id=&start_month=YYYY-MM&end_month=YYYY-MM`
- `GET /reports/income-statement/accounts/{account_id}/entries?book_id=&month=YYYY-MM`
- `GET /reports/invoices/settlement-by-customer?book_id=&customer_guid=&posted_start_date=&posted_end_date=&sort_key=&sort_direction=&page=&page_size=`
  - returns `{items, customer_summaries, page, page_size, total_items, total_pages}`.
  - each item includes invoice amount (`total_num`, `total_denom`, `currency_guid`) and payment status (`PAID` or `OPEN`).
  - includes posted invoices that are `PAID` and `OPEN`.
  - for `PAID` rows, day-difference reference is settlement date; for `OPEN` rows, reference is current date.
  - default ordering is `posted_month_end_date` ascending.

Validation notes:
- month format and range limits are enforced.
- drill-down account must belong to selected book and be `INCOME` or `EXPENSE`.
