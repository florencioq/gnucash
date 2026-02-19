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
