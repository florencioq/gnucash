# 04 - Endpoints (Human Guide)

## General behavior

- IDs are UUID strings.
- Timestamps use RFC3339 UTC (`...Z`).
- Error payload format: `code`, `message`, `details`.
- Validation/invariant failures are returned as `400` or `409` by application handlers.
- Runtime-generated OpenAPI may still list `422` defaults from FastAPI metadata.

## Health

- `GET /health`: service liveness (`{"status":"ok"}`).

## Books

- `POST /books`: create book (`is_active` optional).
- `GET /books`: list books (active first).
- `GET /books/active`: get active book.
- `GET /books/{book_id}`: get by id.
- `PATCH /books/{book_id}`: patch `name`/`is_active`.
- `DELETE /books/{book_id}`: delete when no linked accounts, invoices/bills, customers, vendors.

## Commodities

- `POST /commodities`
- `GET /commodities?namespace=`
- `GET /commodities/{commodity_id}`
- `PATCH /commodities/{commodity_id}`
- `DELETE /commodities/{commodity_id}` (blocked while referenced by accounts, customers, vendors, invoices/bills, transactions).

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

## Vendors

- `POST /vendors`
- `GET /vendors?book_id=`
- `GET /vendors/{vendor_guid}`
- `PATCH /vendors/{vendor_guid}`
- `DELETE /vendors/{vendor_guid}` (blocked while referenced by vendor bills).

## Invoices (customer flow)

- `POST /invoices`
- `GET /invoices?book_id=&customer_guid=`
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
  - post account must be same-book `ASSET`, non-placeholder, commodity-compatible.
- `POST /invoices/{invoice_guid}/unpost`
  - blocked if payment splits exist in posting lot.

Payments:
- `POST /invoices/{invoice_guid}/payments`
  - partial payments allowed.
  - amount must be positive and <= open balance.
- `POST /invoices/{invoice_guid}/payments/{payment_tx_guid}/undo`
  - posting tx cannot be undone via this endpoint.

## Bills (vendor purchase flow)

- `POST /bills`
- `GET /bills?book_id=&vendor_guid=`
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
  - post account must be same-book `LIABILITY`, non-placeholder, commodity-compatible.
- `POST /bills/{bill_guid}/unpost`
  - blocked if payment splits exist in posting lot.

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

Validation notes:
- month format and range limits are enforced.
- drill-down account must belong to selected book and be `INCOME` or `EXPENSE`.
