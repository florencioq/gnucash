# 07 - Acceptance Tests

## Scenario 1: Create and list Book

1. Send `POST /books` with `name="Demo"`.
2. Validate `201` response with UUID string `id` and UTC `created_at` (`Z`).
3. Send `GET /books`.
4. Validate that the created Book appears in the list.

## Scenario 2: Create BRL Commodity

1. Send `POST /commodities` with `namespace=CURRENCY`, `mnemonic=BRL`, `fraction=100`.
2. Validate `201`.
3. Send `GET /commodities?namespace=CURRENCY`.
4. Validate BRL commodity is present.

## Scenario 3: Reject duplicated commodity key

1. Create commodity (`CURRENCY`, `USD`).
2. Attempt to create another with the same pair (`CURRENCY`, `USD`).
3. Validate `409` conflict with a uniqueness violation `code`.

## Scenario 4: Create root and child accounts

1. Create Book and Commodity.
2. Send `POST /accounts` for root account `Root` with `type=ROOT` and `is_placeholder=true` (omit `parent_id` or set it to `null`).
3. Validate `201`.
4. Send `POST /accounts` for child account `Assets` with root account `parent_id`.
5. Validate `201`.

## Scenario 5: Enforce parent in same book

1. Create two Books (`A` and `B`).
2. Create a root account in `A`.
3. Attempt to create an account in `B` using the `parent_id` from `A`.
4. Validate `400` or `409` for invariant violation.

## Scenario 6: Prevent hierarchy cycles

1. Create accounts `A -> B -> C` in the same Book.
2. Attempt to update `A.parent_id = C.id`.
3. Validate `400` or `409` for cycle violation.

## Scenario 7: List accounts by book

1. Create accounts in two Books.
2. Call `GET /accounts?book_id=<book_1>`.
3. Validate only accounts from `book_1` are returned.

## Scenario 8: Retrieve tree ordered by name

1. Under the root account, create children `Wallet`, `Bank`, `Cash`.
2. Call `GET /accounts/tree?book_id=<id>`.
3. Validate recursive structure and sibling alphabetical order (`Bank`, `Cash`, `Wallet`).

## Scenario 9: Delete restrictions

1. Attempt `DELETE /accounts/{id}` on an account with children.
2. Validate `409`.
3. Attempt `DELETE /commodities/{id}` when referenced by an account.
4. Validate `409`.
5. Attempt `DELETE /books/{id}` when accounts are linked.
6. Validate `409`.

## Scenario 10: Update account placeholder flag

1. Create a Book and an Account with `is_placeholder=false`.
2. Send `PATCH /accounts/{id}` with `is_placeholder=true`.
3. Validate `200` and `is_placeholder=true`.

## Scenario 11: Create balanced transaction with two splits

1. Create Book, Commodity, and two accounts in the same book.
2. Send `POST /transactions` with two splits where `sum(value_num/value_denom) = 0`.
3. Validate `201`.
4. Validate transaction payload includes both splits.

## Scenario 12: Reject unbalanced transaction

1. Create Book, Commodity, and two accounts.
2. Send `POST /transactions` with split values that do not sum to zero.
3. Validate `409` with unbalanced transaction `code`.

## Scenario 13: Reject cross-book splits

1. Create two books with one account each.
2. Send `POST /transactions` using split accounts from different books.
3. Validate `409` for cross-book invariant violation.
