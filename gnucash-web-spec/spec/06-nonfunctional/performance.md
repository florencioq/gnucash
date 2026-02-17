# 06 - Performance

## Baseline expectations

1. CRUD and posting endpoints SHOULD keep predictable latency for moderate business volumes.
2. `GET /accounts/tree` MUST scale for deep hierarchies without quadratic traversal behavior.
3. Invoice/bill listing SHOULD support practical filtering and sorting in client flows.
4. Heavy purchase list flows MUST support server-side pagination (`/bills/list`) to cap response size and improve UI responsiveness.
5. Income statement endpoints SHOULD remain responsive across month ranges up to documented limits.

## Data-access implications

6. Queries by `book_id` SHOULD be indexed and dominant filters should avoid full scans where possible.
7. Posting/payment operations SHOULD be transactionally atomic.
8. Reporting queries SHOULD aggregate in SQL where feasible to reduce application-memory pressure.

## Observability

9. Implementations SHOULD monitor endpoint latency, error rates, and regression trends.
