# gnucash-web-spec

Normative domain specification for the MVP accounting scope limited to **Book**, **Commodity**, and **Account** (with hierarchy), including API contracts and validation criteria.

## Objective

This repository defines stable contracts to guide multiple implementations without technology coupling in the main specification.

This specification:
- MUST define domain rules, invariants, and observable behaviors.
- MUST keep strict focus on the v0.1.0 scope.
- MUST remain technology-agnostic in `spec/**`, except in `spec/implementation-profiles/**`.

## Scope v0.1.0

Includes only:
- Book
- Commodity
- Account (with parent/children)
- CRUD for these entities
- Account tree endpoint

Out of scope:
- billing
- accounts payable / accounts receivable
- invoices, bills, payments
- any entity outside the three listed above

## How to use

1. Read `spec/00-introduction.md` and `spec/01-glossary.md`.
2. Implement data and rules from `spec/02-domain/**` and `spec/03-data/**`.
3. Implement API behavior exactly as defined in `spec/04-api/openapi.yaml`.
4. Validate against `spec/07-testing/acceptance-tests.md`.

## Versioning

- Versioning MUST follow SemVer (`MAJOR.MINOR.PATCH`).
- Breaking contract changes MUST increment `MAJOR`.
- Backward-compatible additions MUST increment `MINOR`.
- Editorial fixes/clarifications without contract changes SHOULD increment `PATCH`.
- Every release MUST record changes in `CHANGELOG.md`.
