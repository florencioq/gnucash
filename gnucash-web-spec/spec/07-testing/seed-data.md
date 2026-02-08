# 07 - Seed Data

## Minimum seed set

### Commodity seed

- `id`: implementation-defined stable UUID
- `namespace`: `CURRENCY`
- `mnemonic`: `BRL`
- `fullname`: `Brazilian Real`
- `fraction`: `100`
- `quote`: `false`

### Book seed

- `id`: implementation-defined stable UUID
- `name`: `Demo`
- `created_at`: UTC timestamp

## Seed constraints

- Seeds MUST satisfy all domain invariants.
- Seeds SHOULD be idempotent across repeated runs.
