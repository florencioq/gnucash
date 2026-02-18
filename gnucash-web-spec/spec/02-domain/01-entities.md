# 02.01 - Entities

## Book

Fields:
- `id: string(36)` UUID
- `name: string(120) | null`
- `is_active: boolean`
- `created_at: timestamp UTC`

## Document Number Counter

Fields:
- `book_id: string(36)` (composite key part)
- `owner_type: CUSTOMER | VENDOR` (composite key part)
- `next_value: integer >= 1`
- `width: integer >= 1`

## User

Fields:
- `id: string(36)` UUID
- `email: string(320)` normalized lowercase
- `password_hash: string(255)` salted iterative hash
- `full_name: string(255) | null`
- `is_active: boolean`
- `is_superuser: boolean`
- `created_at: timestamp UTC`
- `updated_at: timestamp UTC`

## User Book Access

Fields:
- `user_id: string(36)` (composite key part)
- `book_id: string(36)` (composite key part)
- `role: VIEWER | EDITOR`
- `created_at: timestamp UTC`

## Commodity

Fields:
- `id: string(36)` UUID
- `namespace: string(32)`
- `mnemonic: string(16)`
- `fullname: string(128) | null`
- `fraction: integer > 0`
- `quote: boolean`

## Account

Fields:
- `id: string(36)` UUID
- `book_id: string(36)`
- `parent_id: string(36) | null`
- `name: string(120)`
- `code: string(64) | null`
- `description: string(255) | null`
- `type: AccountType`
- `commodity_id: string(36)`
- `is_placeholder: boolean`
- `created_at: timestamp UTC`
- `updated_at: timestamp UTC`

## Customer

Fields:
- `guid: string(36)` UUID
- `book_id: string(36)`
- `name: string(2048)`
- `id: string(2048)`
- `currency_guid: string(36)`
- `active: boolean`
- `notes: string(2048)`
- address/contact fields
- `created_at: timestamp UTC`
- `updated_at: timestamp UTC`

## Vendor

Fields:
- `guid: string(36)` UUID
- `book_id: string(36)`
- `name: string(2048)`
- `id: string(2048)`
- `currency_guid: string(36)`
- `active: boolean`
- `notes: string(2048)`
- address/contact fields
- `created_at: timestamp UTC`
- `updated_at: timestamp UTC`

## Invoice/Bill Header (`invoices`)

Fields:
- `guid: string(36)` UUID
- `book_id: string(36)`
- `id: string(2048)` business number
- `invoice_type: INVOICE | CREDIT_NOTE`
- `owner_type: CUSTOMER | VENDOR`
- `owner_guid: string(36)` polymorphic owner id
- `currency_guid: string(36)`
- `date_opened: timestamp UTC | null`
- `date_posted: timestamp UTC | null`
- `active: boolean`
- `terms: string(36) | null`
- `billing_id: string(2048) | null`
- `post_txn/post_lot/post_acc: string(36) | null`
- `created_at: timestamp UTC`
- `updated_at: timestamp UTC`

## Invoice/Bill Entry (`entries`)

Fields:
- `guid: string(36)` UUID
- `invoice_guid: string(36)`
- `date: timestamp UTC`
- `description/action/notes`
- `income_account_guid` (`i_acct`) : string(36)
- quantity/unit-price/discount rationals
- discount metadata (`discount_type`, `discount_how`)
- tax flags
- `created_at: timestamp UTC`
- `updated_at: timestamp UTC`

## Lot

Fields:
- `guid: string(36)` UUID
- `account_guid: string(36)`
- `is_closed: boolean`

## Transaction

Fields:
- `guid: string(36)` UUID
- `currency_guid: string(36)`
- `num: string(2048)`
- `post_date: timestamp UTC | null`
- `enter_date: timestamp UTC | null`
- `description: string(2048) | null`

## Split

Fields:
- `guid: string(36)` UUID
- `tx_guid: string(36)`
- `account_guid: string(36)`
- `memo/action/reconcile_state/reconcile_date`
- `value_num/value_denom`
- `quantity_num/quantity_denom`
- `lot_guid: string(36) | null`
