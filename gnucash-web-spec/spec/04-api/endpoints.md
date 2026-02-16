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
