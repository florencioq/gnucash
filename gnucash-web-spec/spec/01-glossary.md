# 01 - Glossary

## Book

Logical container that groups an isolated set of accounts.

- A `Book` MUST have a unique `id`.
- A `Book` MAY have a `name`.
- A `Book` contains multiple `Account` records.

## Commodity

Currency or traded unit used to denominate accounts.

- `namespace`: commodity category (for example, `CURRENCY`).
- `mnemonic`: short symbol within the namespace (for example, `BRL`, `USD`).
- `fraction`: smallest common unit (SCU), for example `100` for cents.

## Account

Chart-of-accounts node that belongs to a `Book` and references one `Commodity`.

- `parent_id` defines an optional hierarchy.
- Without `parent_id`, the account is a root in the `Book`.
- With `parent_id`, the account is a child of another `Account` in the same `Book`.

## AccountType

Account category. MUST be one of:
- `ROOT`
- `ASSET`
- `LIABILITY`
- `INCOME`
- `EXPENSE`
- `EQUITY`

Type meaning:
- `ROOT`: synthetic root node for a book's account hierarchy.
- `ASSET`: value owned or controlled by the book (for example, cash, bank balances, receivables, inventory).
- `LIABILITY`: obligation owed by the book to another party (for example, loans, credit card balances, payables).
- `INCOME`: inflow that increases economic benefit during a period (for example, salary, sales revenue, interest received).
- `EXPENSE`: outflow or consumption that reduces economic benefit during a period (for example, rent, utilities, fees).
- `EQUITY`: residual interest in assets after liabilities (owner's stake, retained earnings, capital accounts).

## Placeholder Account

Account flagged with `is_placeholder = true` for hierarchical organization.

- A placeholder account MAY have child accounts.
- Preventing postings on placeholder accounts is a **future constraint** and is not defined in v0.2.0.

## Parent / Child

Hierarchical relationship between accounts:
- `parent`: immediate node above.
- `children`: immediate nodes below.

Hierarchy MUST form an acyclic tree (or forest per `Book`).

## Transaction

Accounting entry header that groups one or more `Split` records.

- A `Transaction` MUST reference one `Commodity` as entry currency.
- A `Transaction` MUST contain at least two splits.
- A `Transaction` is balanced only when the sum of all split `value` entries is zero.

## Split

One leg of a transaction posted to a specific account.

- A `Split` MUST reference one `Transaction`.
- A `Split` MUST reference one `Account`.
- `value_num/value_denom` represent value in transaction currency.
- `quantity_num/quantity_denom` represent quantity in account commodity units.
