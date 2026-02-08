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
- `ASSET`
- `LIABILITY`
- `INCOME`
- `EXPENSE`
- `EQUITY`

## Placeholder Account

Account flagged with `is_placeholder = true` for hierarchical organization.

- A placeholder account MAY have child accounts.
- Preventing postings on placeholder accounts is a **future constraint** and is not defined in v0.1.0.

## Parent / Child

Hierarchical relationship between accounts:
- `parent`: immediate node above.
- `children`: immediate nodes below.

Hierarchy MUST form an acyclic tree (or forest per `Book`).
