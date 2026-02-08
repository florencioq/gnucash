# 03.02 - Identifiers

## ID format

- `Book`, `Commodity`, and `Account` IDs MUST be UUID strings with 36 characters.
- External contracts MUST treat IDs as opaque values (no business meaning embedded in the ID).

## Contract handling

- Clients MUST send and receive IDs as `string`.
- Services MUST validate the expected UUID textual format.
- Identity comparisons MUST be exact (case-sensitive over the transmitted value).

## Stability

- Once issued, an ID MUST remain stable for the entity throughout its lifecycle.
