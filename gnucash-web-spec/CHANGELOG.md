# Changelog

## v0.3.0 - 2026-02-15

Extended API and profile coverage:
- added `code`, `balance_num`, and `balance_denom` to `AccountTreeNode` in OpenAPI
- clarified `/accounts/tree` response expectations in human endpoint guide
- added acceptance scenario for account tree code/balance payload
- added acceptance scenario for transaction editing via `PATCH /transactions/{tx_guid}`
- updated FastAPI+React+PostgreSQL implementation profile with account-tree UX and ledger-editing guidance

## v0.2.0 - 2026-02-15

Extended specification with accounting postings:
- added `Transaction` and `Split` domain entities
- added posting invariants (balanced splits, same-book splits, posting delete integrity)
- added transaction API endpoints and schemas in OpenAPI
- added acceptance scenarios for posting flows
- aligned release plan with posting scope

## v0.1.0 - 2026-02-08

Initial specification release with:
- domain and invariants for Book, Commodity, and Account
- logical model and identifier conventions
- OpenAPI contract for CRUD and account tree
- initial non-functional requirements
- acceptance scenarios and seed data
- reference implementation profile (FastAPI + React + PostgreSQL)
