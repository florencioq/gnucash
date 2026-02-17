# 03.02 - Identifiers

## ID format

The API uses UUID textual format (36-char canonical form) for primary identifiers, including:
- `Book.id`
- `Commodity.id`
- `Account.id`
- `Customer.guid`
- `Vendor.guid`
- `Invoice.guid`
- `InvoiceEntry.guid`
- `Lot.guid`
- `Transaction.guid`
- `Split.guid`

## Polymorphic owner identifier

`Invoice.owner_guid` is polymorphic and resolved by `owner_type`:
- `CUSTOMER` -> `customers.guid`
- `VENDOR` -> `vendors.guid`

## Contract handling

- Clients MUST send and receive IDs as strings.
- Services MUST validate UUID textual format at API boundaries.
- Identity comparisons are exact over transmitted values.

## Stability

Once issued, an entity identifier MUST remain stable across its lifecycle.
