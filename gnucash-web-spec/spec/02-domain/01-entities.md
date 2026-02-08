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
