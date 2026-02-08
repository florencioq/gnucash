# 02.02 - Invariants

## Mandatory rules

1. `Account.book_id` MUST be present and MUST reference an existing `Book`.
2. `Account.commodity_id` MUST be present and MUST reference an existing `Commodity`.
3. `Account.type` MUST be one of: `ROOT`, `ASSET`, `LIABILITY`, `INCOME`, `EXPENSE`, `EQUITY`.
4. `Commodity(namespace, mnemonic)` MUST be unique in the full dataset.
5. `created_at` and `updated_at` timestamps MUST be represented in UTC.

## Hierarchy rules

6. If `Account.type` is `ROOT`, then `Account.parent_id` MUST be `null`.
7. If `Account.parent_id` is `null`, then `Account.type` MUST be `ROOT`.
8. If `Account.parent_id` is present, it MUST reference an existing `Account`.
9. If `Account.parent_id` is present, parent and child MUST share the same `book_id`.
10. Account hierarchy MUST be acyclic.
11. An account MUST NOT be its own parent.

## Delete integrity rules

12. Deleting a `Book` MUST fail when there are `Account` records linked to it.
13. Deleting a `Commodity` MUST fail when there are `Account` records linked to it.
14. Deleting an `Account` MUST fail when it has one or more children.

## Placeholder note

15. `is_placeholder = true` MAY be used to model grouping nodes and MAY have children.
16. Blocking transactional postings on placeholders is a **future constraint** and is out of scope for v0.1.0.
