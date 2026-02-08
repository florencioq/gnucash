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
- `GET /books`: list Books.
- `GET /books/{book_id}`: fetch a Book by ID.
- `PATCH /books/{book_id}`: update `name`.
- `DELETE /books/{book_id}`: delete a Book.
  - MUST return `409` if linked `Account` records exist.

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
- `GET /accounts?book_id=`: list accounts for a Book.
- `GET /accounts/{account_id}`: fetch by ID.
- `PATCH /accounts/{account_id}`: partial update.
  - MUST preserve hierarchy acyclicity.
- `DELETE /accounts/{account_id}`: delete an account.
  - MUST return `409` if the account has children.
  - Rule about references from future posting entities is reserved for a future phase.
- `GET /accounts/tree?book_id=`: return hierarchy for `book_id`.
  - sibling nodes MUST be ordered by `name`.
