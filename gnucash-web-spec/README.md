# gnucash-web-spec

Normative domain specification for the current GnuCash Web scope.

## Objective

This repository defines stable contracts to guide implementations while keeping `spec/**` technology-agnostic (except `spec/implementation-profiles/**`).

## Current scope

Includes:
- Book and active-book workflow
- Commodity
- User authentication (`/auth/*`) with access/refresh tokens
- User authorization with `is_superuser` and per-book access grants
- Account hierarchy and account tree balances
- Customer and Vendor masters
- Invoice and Bill workflows (entries, posting, unposting, payments, payment undo)
- Paginated invoice/bill summary listing contracts (`/invoices/list`, `/bills/list`)
- Operational open-items screens (`Contas a Receber` / `Contas a Pagar`) backed by posted+open filters
- Transaction/Split posting and editing restrictions when linked to invoice/bill flows
- Income statement reporting endpoints

Out of scope:
- tax engine and taxtable behavior
- inventory costing rules
- closing process and period lock semantics

## How to use

1. Read `spec/00-introduction.md` and `spec/01-glossary.md`.
2. Implement data and invariants from `spec/02-domain/**` and `spec/03-data/**`.
3. Implement API behavior from `spec/04-api/openapi.yaml` and clarifications in `spec/04-api/endpoints.md`.
4. Validate behavior against `spec/07-testing/acceptance-tests.md` and automated backend tests.

## Versioning

- Versioning follows SemVer (`MAJOR.MINOR.PATCH`).
- Breaking contract changes increment `MAJOR`.
- Backward-compatible additions increment `MINOR`.
- Editorial clarifications increment `PATCH`.
- Every release MUST be recorded in `CHANGELOG.md`.
