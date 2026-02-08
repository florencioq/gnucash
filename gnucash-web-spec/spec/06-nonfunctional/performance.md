# 06 - Performance

## Baseline expectations

1. CRUD operations SHOULD maintain predictable latency for moderate volumes.
2. `GET /accounts/tree` MUST scale acceptably for deep and wide hierarchies.

## Data access implications

3. Queries by `book_id` SHOULD be optimized.
4. Tree construction SHOULD minimize round-trips and avoid quadratic behavior.
5. Ordering by `name` in the tree endpoint MUST be consistent for sibling sets at every level.

## Observability

6. Implementations SHOULD measure endpoint response times and track regressions.
