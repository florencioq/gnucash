# Changelog

## v0.3.3 - 2026-02-16

Invoicing UX profile update:
- documented that invoice entry revenue-account selection SHOULD use a tree picker (`income_account_guid`) rather than a flat dropdown

## v0.3.2 - 2026-02-16

Active-book workflow alignment:
- added active-book contract updates to endpoint guide (`GET /books/active`, `is_active` create/patch behavior)
- updated OpenAPI book schemas with `is_active` and added `GET /books/active`
- updated React implementation profile to use active-book context across operational forms

## v0.3.1 - 2026-02-16

Specification clarifications and React profile UX updates:
- clarified glossary and endpoint guide expectations for handling synthetic `ROOT` nodes in client selectors
- documented account-creation UX rule to auto-set child account `type` from selected parent `type` (except `ROOT`)
- documented tree-picker-first account parent selection and omission of `ROOT` prefix in selector path labels

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
