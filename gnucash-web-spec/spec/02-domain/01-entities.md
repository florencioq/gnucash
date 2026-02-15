# 02.01 - Entities

## Book

Fields:
- `id: string(36)` - textual UUID identifier.
- `name: string(120) | null`.
- `created_at: timestamp UTC`.

Relationships:
- `Book` 1:N `Account`.

## Commodity

Fields:
- `id: string(36)`.
- `namespace: string(32)`.
- `mnemonic: string(16)`.
- `fullname: string(128) | null`.
- `fraction: integer`.
- `quote: boolean`.

Relationships:
- `Commodity` 1:N `Account`.

## Account

Fields:
- `id: string(36)`.
- `book_id: string(36)`.
- `parent_id: string(36) | null`.
- `name: string(120)`.
- `code: string(64) | null`.
- `description: string(255) | null`.
- `type: AccountType`.
- `commodity_id: string(36)`.
- `is_placeholder: boolean`.
- `created_at: timestamp UTC`.
- `updated_at: timestamp UTC`.

Relationships:
- `Account` N:1 `Book`.
- `Account` N:1 `Commodity`.
- `Account` N:1 `Account` (parent).
- `Account` 1:N `Account` (children).
- `Account` 1:N `Split`.

## Transaction

Fields:
- `guid: string(36)` - textual UUID identifier.
- `currency_guid: string(36)`.
- `num: string(2048)`.
- `post_date: timestamp UTC | null`.
- `enter_date: timestamp UTC | null`.
- `description: string(2048) | null`.

Relationships:
- `Transaction` N:1 `Commodity` (currency).
- `Transaction` 1:N `Split`.

## Split

Fields:
- `guid: string(36)`.
- `tx_guid: string(36)`.
- `account_guid: string(36)`.
- `memo: string(2048)`.
- `action: string(2048)`.
- `reconcile_state: string(1)`.
- `reconcile_date: timestamp UTC | null`.
- `value_num: int64`.
- `value_denom: int64` (MUST be > 0).
- `quantity_num: int64`.
- `quantity_denom: int64` (MUST be > 0).
- `lot_guid: string(36) | null`.

Relationships:
- `Split` N:1 `Transaction`.
- `Split` N:1 `Account`.
