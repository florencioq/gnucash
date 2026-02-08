# 03.03 - Currencies and Commodities

## Semantics

`Commodity` represents a denomination unit.

Primary fields:
- `namespace`: commodity class (for example, `CURRENCY`, `FUND`).
- `mnemonic`: short symbol unique within a namespace.
- `fraction`: smallest common unit (SCU).

## Rules

- (`namespace`, `mnemonic`) MUST be unique.
- `fraction` MUST be a positive integer.
- `fraction` SHOULD reflect the smallest granularity used by the domain.

## Examples

- BRL: `namespace=CURRENCY`, `mnemonic=BRL`, `fraction=100`
- USD: `namespace=CURRENCY`, `mnemonic=USD`, `fraction=100`

## Usage with Account

- Every `Account` MUST reference a valid `Commodity` via `commodity_id`.
- Changing commodity on an existing account MAY be allowed by contract as long as invariants remain valid.
