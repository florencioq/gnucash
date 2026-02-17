# 03.03 - Currencies and Commodities

## Semantics

`Commodity` represents denomination units used by accounts, parties, invoices/bills, and transactions.

Primary fields:
- `namespace`
- `mnemonic`
- `fraction`

## Rules

1. (`namespace`, `mnemonic`) MUST be unique.
2. `fraction` MUST be a positive integer.
3. `fraction` SHOULD match the smallest practical unit used in posting/payment flows.

## Usage alignment rules

4. Account commodity MUST match account posting arithmetic.
5. Invoice/bill currency MUST match posting account and payment transfer account commodities.
6. Transaction `currency_guid` MUST match transaction value arithmetic precision constraints.

## Examples

- BRL: `namespace=CURRENCY`, `mnemonic=BRL`, `fraction=100`
- USD: `namespace=CURRENCY`, `mnemonic=USD`, `fraction=100`
