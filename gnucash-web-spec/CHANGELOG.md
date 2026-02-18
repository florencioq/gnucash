# Changelog

## v0.4.6 - 2026-02-18

Invoicing/purchasing entry-editor UX synchronization:
- updated implementation profile to require empty initial revenue-account selection for invoice entry editor (`income_account_guid`)
- updated implementation profile to require clean-state behavior in `Nova Fatura`/`Nova Compra` tabs (no stale details from previously selected documents)
- updated implementation profile to require leaf-first account path labels (`account / parent / ...`) and wider account selector columns in invoice/bill entry editors

## v0.4.5 - 2026-02-18

Purchasing expense-account initialization sync:
- updated implementation profile to require empty initial selection for bill entry expense account (`income_account_guid`) until user chooses an account

## v0.4.4 - 2026-02-18

Ledger interaction rules synchronization:
- updated implementation profile to require newest-first default order in Ledger with user-selectable chronological inversion
- updated implementation profile to set Ledger pagination default to 10 items per page
- updated implementation profile to forbid edit/delete actions in Ledger for transactions linked to invoice/bill workflows, directing users to `Faturamentos`/`Compras`

## v0.4.3 - 2026-02-18

Ledger UX and detail-tab behavior synchronization:
- updated implementation profile to require explicit delete confirmation for invoice/bill documents and automatic closure of the corresponding dynamic detail tab after successful deletion
- updated implementation profile to require business-number-first tab labels (invoice/bill id) for documents opened from linked flows (for example Ledger), with GUID fallback only when number is unavailable
- updated implementation profile to require taller tree-picker viewport for account selection in deep hierarchies
- updated implementation profile and performance guidance to include pagination controls for Ledger transaction screens

## v0.4.2 - 2026-02-17

Invoicing pagination and dynamic-tab UX synchronization:
- documented paginated invoice summary endpoint `GET /invoices/list` with filter/sort/page contract in endpoint guide
- updated OpenAPI contract with `/invoices/list` plus `InvoiceListPageOut`/`InvoiceListItemOut` schemas
- updated acceptance coverage notes to include invoice paginated listing behavior
- updated implementation profile to require list-side create actions (`Nova Fatura` / `Nova Compra`)
- updated implementation profile to require dynamic, closable detail tabs (`Fatura` / `Compra`) persisted after browser refresh in-session
- generalized non-functional/release/README references to pagination baseline across both invoicing and purchasing flows

## v0.4.1 - 2026-02-17

Purchasing list pagination and UX stability sync:
- documented paginated bill summary endpoint `GET /bills/list` with filter/sort/page contract
- updated OpenAPI contract with `BillListPageOut`/`BillListItemOut` schemas and `/bills/list` query parameters
- updated implementation profile to require server-side pagination for `Compras` list and tab-stable filter state
- updated acceptance coverage notes to include bill paginated listing behavior
- updated performance/release docs to reflect pagination baseline for heavy purchase list flows

## v0.4.0 - 2026-02-17

Full specification synchronization with runtime system:
- aligned repository scope and introduction with implemented domains (customers, vendors, invoices, bills, payments, reports)
- updated domain and data model docs with current entities, invariants, and lifecycle rules
- regenerated OpenAPI contract from backend runtime (`app.openapi()`) to reflect actual endpoints and schemas
- updated human endpoint guide to include health, parties, reports, and posting/payment restrictions
- revised acceptance-testing document to match real automated suite coverage
- updated release plans and non-functional docs to current baseline
- refreshed API examples and implementation profile for current frontend/backend architecture

## v0.3.8 - 2026-02-17

Invoicing and purchasing UI split clarification:
- updated React implementation profile to require dedicated list + detail views for invoicing (`Faturamentos`/`Fatura`) and purchasing (`Compras`/`Compra`)
- documented sortable list expectations and explicit open-to-detail action for both workflows
- documented explicit missing-owner fallback labels in list views (`cliente não encontrado` / `fornecedor não encontrado`)

## v0.3.7 - 2026-02-16

Purchasing bill workflow update:
- documented bill endpoints mirroring invoice behavior (`/bills`, entries, post/unpost, payments, payment undo)
- added acceptance scenarios for bill posting, partial/full payments, and payment undo/unpost flow
- updated implementation profile with bill UI parity requirements versus invoicing
- prepared OpenAPI extension points for bill contracts aligned with vendor purchase lifecycle

## v0.3.6 - 2026-02-16

Invoice payment workflow update:
- documented invoice payment and payment-undo endpoints in the endpoint guide
- added acceptance scenarios for partial/full payment and undo behavior
- updated React implementation profile with invoicing payment UX guidance
- synchronized OpenAPI contract with invoice payment request/response schemas and extended invoice totals/status fields

## v0.3.5 - 2026-02-16

Invoice posting workflow update:
- documented invoice posting/unposting endpoints and lifecycle behavior in the endpoint guide
- added acceptance scenarios for invoice post/unpost and unpost rejection when lot already has payment splits
- updated React implementation profile with posted-invoice UX requirements (explicit post/unpost actions and line-edit lock while posted)
- synchronized OpenAPI contract with invoice/entry/post/unpost endpoints and posting metadata fields

## v0.3.4 - 2026-02-16

Invoicing layout profile update:
- documented that invoicing UI SHOULD use a wider content container than other pages for improved data-entry space

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
