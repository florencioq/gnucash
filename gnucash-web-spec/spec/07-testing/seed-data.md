# 07 - Seed Data

## Minimum seed set

### Commodity seed

- `id`: stable UUID
- `namespace`: `CURRENCY`
- `mnemonic`: `BRL`
- `fullname`: `Brazilian Real`
- `fraction`: `100`
- `quote`: `false`

### Book seed

- `id`: stable UUID
- `name`: `Demo`
- `is_active`: `true`
- `created_at`: UTC timestamp

## Seed constraints

1. Seeds MUST satisfy all invariants.
2. Seeds MUST be idempotent.
3. Re-running seed SHOULD preserve configured seed identifiers.
