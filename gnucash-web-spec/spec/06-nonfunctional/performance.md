# 06 - Performance

## Baseline expectations

1. CRUD and posting endpoints SHOULD keep predictable latency for moderate business volumes.
2. `GET /accounts/tree` MUST scale for deep hierarchies without quadratic traversal behavior.
3. Invoice/bill listing SHOULD support practical filtering and sorting in client flows.
4. Heavy invoicing and purchase list flows MUST support server-side pagination (`/invoices/list`, `/bills/list`) to cap response size and improve UI responsiveness.
5. Ledger transaction screens SHOULD support pagination in the UI to keep account-history navigation responsive on large books.
6. Income statement endpoints SHOULD remain responsive across month ranges up to documented limits.
7. Open dynamic tabs SHOULD preserve mounted page context while users switch tabs, avoiding unnecessary full re-initialization/refetch on focus changes.

## Data-access implications

8. Queries by `book_id` SHOULD be indexed and dominant filters should avoid full scans where possible.
9. Posting/payment operations SHOULD be transactionally atomic.
10. Reporting queries SHOULD aggregate in SQL where feasible to reduce application-memory pressure.

## Observability

11. Implementations SHOULD monitor endpoint latency, error rates, and regression trends.

## UI stability

12. UI actions that open/focus dynamic tabs MUST be idempotent: invoking the same action with equivalent payload MUST NOT create additional state transitions.
13. Cross-view synchronization callbacks MUST ignore unchanged values and MUST NOT emit parent-state updates for equivalent state.
14. Hidden/inactive tabs MUST NOT trigger navigation-state changes while not active.
15. After drill-down navigation actions (for example `DRE Mensal` -> `Razão`), active tab and selected context SHOULD stabilize and remain unchanged until a new explicit user action.
