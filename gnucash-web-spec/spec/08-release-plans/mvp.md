# 08 - Release Plan: Current Baseline

## Target version

- `v0.4.x`

## Functional deliverables

1. Book, commodity, account, customer, and vendor CRUD.
2. Active-book workflow (`GET /books/active`, active switching semantics).
3. Account tree endpoint with balances.
4. Invoice and bill workflows (entries, post/unpost, payments, payment undo).
5. Transaction/split CRUD with balance and linkage guards.
6. Income statement reporting endpoints.
7. Standardized error payload (`code`, `message`, `details`).

## Quality gates

1. Automated backend test suite MUST pass.
2. Invariants MUST be enforced across create/update/delete/post/payment flows.
3. Human endpoint guide and OpenAPI contract MUST reflect runtime behavior.

## Immediate backlog

Near-term implementation items that do not change this baseline scope are tracked in `spec/08-release-plans/immediate-backlog.md`.
