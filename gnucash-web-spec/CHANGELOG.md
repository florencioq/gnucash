# Changelog

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
