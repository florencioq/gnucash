# 08 - Release Plan: MVP

## Target version

- `v0.1.x`

## Functional deliverables

1. `Book` CRUD.
2. `Commodity` CRUD with `namespace` filter.
3. `Account` CRUD with parent/children hierarchy.
4. Endpoint `GET /accounts/tree?book_id=`.
5. Standardized error payload (`code`, `message`, `details`).

## Quality gates

1. All scenarios in `spec/07-testing/acceptance-tests.md` MUST pass.
2. Invariants MUST be enforced in create/update/delete flows.
3. API documentation MUST match runtime behavior.
