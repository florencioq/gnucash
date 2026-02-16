# 04 - Endpoints (Human Guide)

## General behavior

- IDs MUST be UUID strings.
- Timestamps MUST use RFC3339 UTC (`...Z`).
- Validation/invariant errors MUST return `400` or `409` with:
  - `code`
  - `message`
  - `details`

## Books

- `POST /books`: create a Book.
  - `is_active` MAY be provided to mark the new Book as active.
  - if there is no active Book yet, the created Book MUST become active.
- `GET /books`: list Books.
- `GET /books/active`: fetch the currently active Book.
- `GET /books/{book_id}`: fetch a Book by ID.
- `PATCH /books/{book_id}`: update `name` and/or `is_active`.
  - when `is_active=true`, other books MUST be deactivated.
  - implementation MUST keep at least one active Book when books exist.
- `DELETE /books/{book_id}`: delete a Book.
  - MUST return `409` if linked `Account` records exist.
  - when deleting the active Book and other books exist, another Book MUST become active.

## Commodities

- `POST /commodities`: create a Commodity.
- `GET /commodities`: list Commodities.
  - Optional filter: `?namespace=`.
- `GET /commodities/{commodity_id}`: fetch by ID.
- `PATCH /commodities/{commodity_id}`: partial update.
- `DELETE /commodities/{commodity_id}`: delete a Commodity.
  - MUST return `409` if any `Account` references it.

## Accounts

- `POST /accounts`: create an Account.
  - `book_id` and `commodity_id` are required.
  - `parent_id` is optional, but MUST reference an account in the same `book_id`.
  - client UIs SHOULD default account `type` to the selected parent account `type` when `parent_id` is chosen (except when parent is `ROOT`).
- `GET /accounts?book_id=`: list accounts for a Book.
- `GET /accounts/{account_id}`: fetch by ID.
- `PATCH /accounts/{account_id}`: partial update.
  - MUST preserve hierarchy acyclicity.
  - SHOULD allow updating `is_placeholder` when editing accounts.
- `DELETE /accounts/{account_id}`: delete an account.
  - MUST return `409` if the account has children.
  - Rule about references from future posting entities is reserved for a future phase.
- `GET /accounts/tree?book_id=`: return hierarchy for `book_id`.
  - sibling nodes MUST be ordered by `name`.
  - each node MUST expose `code` (nullable) and current account balance as exact rational fields (`balance_num`, `balance_denom`).
  - payload MAY include the synthetic `ROOT` node; UI selectors SHOULD hide `ROOT` when choosing parent/posting accounts.

## Invoices and Entries

- `POST /invoices`: create invoice header.
- `GET /invoices?book_id=`: list invoices for a book.
- `GET /invoices/{invoice_guid}`: fetch invoice with entries and totals.
  - response MUST include `paid_amount_*`, `open_amount_*`, and `payments[]` derived from the posting lot.
  - `status` SHOULD follow lifecycle values: `UNPAID` (not posted), `POSTED` (posted without payments), `PARTIAL`, `PAID`, and `INACTIVE` (inactive invoice flag).
- `PATCH /invoices/{invoice_guid}`: partial update invoice header.
  - `date_posted` MUST be read-only; posting lifecycle MUST be handled by dedicated posting endpoints.
  - while posted, structural fields (for example customer, currency, invoice id/type and terms) MUST be blocked until unposted.
- `DELETE /invoices/{invoice_guid}`: delete invoice.
  - MUST return `409` while the invoice is posted.
- `POST /invoices/{invoice_guid}/entries`: add invoice entry.
- `PATCH /invoices/{invoice_guid}/entries/{entry_guid}`: patch invoice entry.
- `DELETE /invoices/{invoice_guid}/entries/{entry_guid}`: remove invoice entry.
  - entry create/update/delete MUST return `409` while invoice is posted.
- `POST /invoices/{invoice_guid}/post`: post invoice into accounting transactions.
  - MUST create posting transaction and posting lot.
  - MUST fill invoice posting references (`post_txn`, `post_lot`, `post_acc`) and `date_posted`.
  - MUST reject posting when invoice has no entries.
- `POST /invoices/{invoice_guid}/unpost`: undo invoice posting.
  - MUST remove posting transaction and clear posting references.
  - MUST reject unpost while payment splits exist in the same posting lot.
- `POST /invoices/{invoice_guid}/payments`: register an invoice payment in the posting lot.
  - MUST accept partial amounts.
  - payment amount MUST be positive and MUST NOT exceed the lot open balance.
  - MUST create one split in receivable posting account (`post_acc`) linked to invoice lot (`post_lot`) and one counter split in transfer account.
- `POST /invoices/{invoice_guid}/payments/{payment_tx_guid}/undo`: undo one previously registered payment transaction.
  - MUST reject undo attempts for the original posting transaction.
  - MUST restore lot open balance and invoice status accordingly.

## Transactions and Splits (Accounting Postings)

- `POST /transactions`: create a transaction with its splits.
  - `currency_guid` is required and MUST reference an existing commodity.
  - request MUST include at least two splits.
  - all split accounts MUST belong to the same book.
  - exact sum of split `value_num/value_denom` MUST be zero.
- `GET /transactions?book_id=`: list transactions filtered by book through split accounts.
- `GET /transactions/{tx_guid}`: fetch a transaction with its splits.
- `PATCH /transactions/{tx_guid}`: partial update transaction fields and optionally replace splits.
  - when `splits` are provided, the same validation rules as create MUST apply.
  - this endpoint MUST support editing an existing posting flow (for example, ledger UI editing).
- `DELETE /transactions/{tx_guid}`: delete transaction.
  - deleting a transaction MUST remove associated splits (or fail atomically).
  - implementation MUST reject delete/patch for transactions linked to posted invoices, including posting transaction and invoice-payment transactions linked by posting lot.
