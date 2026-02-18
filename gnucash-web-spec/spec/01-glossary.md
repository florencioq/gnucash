# 01 - Glossary

## Book

Logical container that isolates accounts, parties, invoices/bills, and reports.

- A `Book` MUST have a unique UUID `id`.
- A `Book` MAY have a `name`.
- Exactly one book SHOULD be active when books exist.

## Commodity

Currency or traded unit used to denominate accounts and transactions.

- `namespace`: commodity category (for example `CURRENCY`).
- `mnemonic`: short symbol (for example `BRL`, `USD`).
- `fraction`: smallest common unit (SCU).

## Account

Chart-of-accounts node that belongs to a `Book` and references a `Commodity`.

- `parent_id` defines optional hierarchy.
- `ROOT` accounts are synthetic tree roots.
- `is_placeholder` identifies non-postable grouping candidates (runtime enforces placeholder restrictions for posting/payment account choices in invoice/bill flows).

## AccountType

Allowed account categories:
- `ROOT`
- `ASSET`
- `LIABILITY`
- `INCOME`
- `EXPENSE`
- `EQUITY`

## Customer / Vendor

Master entities used as invoice/bill owners.

- Both belong to one `Book`.
- Both reference one `Commodity` (`currency_guid`).

## Invoice / Bill

Commercial documents persisted in `invoices` with polymorphic owner:
- `owner_type = CUSTOMER` for invoices
- `owner_type = VENDOR` for bills

Posting metadata:
- `post_txn` (posting transaction)
- `post_lot` (lot used to track open balance)
- `post_acc` (posting account)

## Invoice Entry / Bill Entry

Line item persisted in `entries` and linked to one invoice/bill.

## Lot

Grouping key for open-balance tracking across posting and payment splits.

## Transaction

Accounting entry header grouping two or more `Split` records.

## Split

One leg of a transaction posted to a specific account.

- `value_num/value_denom` is transaction value rational.
- `quantity_num/quantity_denom` is quantity rational.
- `lot_guid` may link split to a lot.

## User

Authenticated API principal.

- `is_superuser` indicates platform-level administrative privileges.
- Non-superusers are authorized through per-book grants.

## User Book Access

Permission grant linking one user to one book.

- `VIEWER`: read-only access for book-scoped resources.
- `EDITOR`: read/write access for book-scoped resources.

## Invoice/Bill Status

Computed status values returned by API:
- `UNPAID`
- `POSTED`
- `PARTIAL`
- `PAID`
- `INACTIVE`
