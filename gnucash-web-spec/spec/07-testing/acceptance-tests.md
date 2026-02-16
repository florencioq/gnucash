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

## Scenario 14: Retrieve tree with account code and balance

1. Create a book, commodity, root account, and one child account with `code`.
2. Post one balanced transaction touching the child account.
3. Call `GET /accounts/tree?book_id=<id>`.
4. Validate the child node returns:
   - `code` (nullable by contract, populated in this scenario),
   - `balance_num`,
   - `balance_denom`.
5. Validate returned balance represents the exact posted amount.

## Scenario 15: Edit transaction with split replacement

1. Create a balanced transaction with two splits.
2. Send `PATCH /transactions/{tx_guid}` replacing description and splits with another balanced pair in the same book.
3. Validate `200`.
4. Validate updated payload reflects the new description and replacement splits.

## Scenario 16: Active book selection flow

1. Create `Book A` and validate it is returned as active.
2. Create `Book B` without `is_active` and validate `Book A` remains active.
3. Send `PATCH /books/{book_b_id}` with `is_active=true`.
4. Validate `GET /books/active` returns `Book B` and `Book A.is_active=false`.

## Scenario 17: Post and unpost invoice

1. Create book, currency, customer, one income account and one receivable account.
2. Create invoice with at least one entry.
3. Send `POST /invoices/{invoice_guid}/post` with receivable posting account.
4. Validate invoice returns `status=POSTED`, with posting references and `date_posted`.
5. Validate posting transaction exists and includes at least one split in receivable account linked to posting lot.
6. Send `POST /invoices/{invoice_guid}/unpost`.
7. Validate invoice returns `status=UNPAID`, posting references cleared, and posting transaction removed.

## Scenario 18: Reject unpost when payment exists in posting lot

1. Post an invoice and capture its posting lot id.
2. Create a payment transaction using the same receivable account and same lot id on receivable split.
3. Send `POST /invoices/{invoice_guid}/unpost`.
4. Validate `409` conflict for invoice-with-payments-in-lot rule.

## Scenario 19: Register partial and full invoice payments

1. Post an invoice with total amount greater than zero.
2. Send `POST /invoices/{invoice_guid}/payments` with a partial amount and a valid transfer account.
3. Validate invoice returns `status=PARTIAL`, payment list with one transaction, and reduced `open_amount`.
4. Send a second payment for the remaining open amount.
5. Validate invoice returns `status=PAID`, `open_amount=0`, and two payment transactions in `payments[]`.
6. Validate payment transactions cannot be patched/deleted via `/transactions/{tx_guid}`.

## Scenario 20: Undo invoice payment

1. Start from an invoice with at least one registered payment.
2. Send `POST /invoices/{invoice_guid}/payments/{payment_tx_guid}/undo`.
3. Validate invoice open amount increases back and payment list no longer contains that transaction.
4. Validate `status` transitions from `PAID` to `PARTIAL` or from `PARTIAL` to `POSTED` depending on remaining payments.

## Scenario 21: Bill posting flow for purchases

1. Create book, currency, vendor, one expense account and one payable account.
2. Create bill with at least one entry.
3. Send `POST /bills/{bill_guid}/post` with payable posting account.
4. Validate bill returns `status=POSTED`, posting references, and `date_posted`.
5. Validate posting transaction includes split in payable account linked to posting lot and opposite expense split.

## Scenario 22: Bill partial payment and full settlement

1. Start from posted bill with open amount greater than zero.
2. Send `POST /bills/{bill_guid}/payments` with a partial amount and valid transfer account.
3. Validate `status=PARTIAL`, reduced `open_amount`, and one payment transaction in `payments[]`.
4. Send another payment for remaining open amount.
5. Validate `status=PAID`, `open_amount=0`, and accumulated payment history.
6. Validate payment-linked transactions cannot be patched/deleted through `/transactions/{tx_guid}`.

## Scenario 23: Undo bill payment and unpost

1. Start from bill with one or more registered payments.
2. Send `POST /bills/{bill_guid}/payments/{payment_tx_guid}/undo`.
3. Validate payment is removed from bill payload and open amount is restored.
4. Repeat undo until no bill payments remain.
5. Send `POST /bills/{bill_guid}/unpost` and validate posting references are cleared.
