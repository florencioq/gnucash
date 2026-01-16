# Data Model

List entities, attributes, and relations. Capture key constraints.

## Entities
- Book: id (GUID), name(optional), created_at
- Commodity: id (GUID), namespace, mnemonic, fullname, fraction, quote
- Account: id (GUID), book_id, parent_id (nullable), name, type, commodity_id, code, description, is_placeholder, created_at

## Relations
- accounts.book_id -> books.id (FK)
- accounts.parent_id -> accounts.id (FK)
- accounts.commodity_id -> commodities.id (FK)

## Constraints
- commodities unique(namespace, mnemonic)
- accounts unique(book_id, parent_id, name)
- account moves must stay within same book and be cycle-free

## Notes
- Default DB: `gnucash_web` (from Compose)
