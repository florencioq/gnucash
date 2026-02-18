# 02.02 - Invariants

## General

1. IDs exposed in API MUST be UUID-formatted strings.
2. Timestamps MUST be UTC and serialized in RFC3339 (`...Z`).
3. Validation/invariant errors MUST return structured payload (`code`, `message`, `details`).

## Books

4. If books exist, there MUST be at least one active book.
5. Activating one book MUST deactivate all other books.
6. Deleting an active book MUST promote another existing book to active when possible.

## Commodity

7. `(namespace, mnemonic)` MUST be unique.
8. `fraction` MUST be a positive integer.

## Accounts and hierarchy

9. `Account.book_id` MUST reference an existing `Book`.
10. `Account.commodity_id` MUST reference an existing `Commodity`.
11. `Account.type` MUST be one of `ROOT|ASSET|LIABILITY|INCOME|EXPENSE|EQUITY`.
12. `ROOT` accounts MUST have `parent_id = null`.
13. Non-`ROOT` accounts MUST have `parent_id != null`.
14. `parent_id`, when present, MUST reference an account in the same `book_id`.
15. Account hierarchy MUST be acyclic.
16. Account cannot be its own parent.

## Customers and vendors

17. `Customer.book_id` and `Vendor.book_id` MUST reference an existing `Book`.
18. `Customer.currency_guid` and `Vendor.currency_guid` MUST reference an existing `Commodity`.
19. Customer/vendor deletion MUST be rejected while referenced by invoice/bill owners.

## Invoices and bills

20. `invoices.owner_type` MUST be `CUSTOMER` or `VENDOR` for API-managed records.
21. For `owner_type=CUSTOMER`, `owner_guid` MUST reference an existing customer in the same book.
22. For `owner_type=VENDOR`, `owner_guid` MUST reference an existing vendor in the same book.
23. `currency_guid` MUST reference an existing commodity.
24. `date_posted` is read-only via header patch and is controlled by post/unpost operations.
25. Posted invoices/bills MUST block structural header edits until unposted.
26. Deleting posted invoices/bills MUST be rejected.
27. Entry create/patch/delete MUST be rejected for posted invoices/bills.

## Posting and payments

28. Invoice post account MUST be same-book, non-placeholder, `ASSET`, and currency-compatible.
29. Bill post account MUST be same-book, non-placeholder, `LIABILITY`, and currency-compatible.
30. Posting requires at least one entry and non-zero total.
31. Posting MUST create balanced splits and posting lot metadata (`post_txn`, `post_lot`, `post_acc`).
32. Unpost MUST remove posting transaction and clear posting metadata.
33. Unpost MUST be rejected when payment splits still exist in posting lot.
34. Payment requires posted invoice/bill and existing posting lot/account consistency.
35. Payment transfer account MUST be same-book, non-placeholder, not `ROOT`, currency-compatible, and different from posting account.
36. Payment amount MUST be positive and MUST NOT exceed lot open balance.
37. Payment undo MUST reject posting transaction and only accept transactions tied to the document lot.

## Transactions and splits

38. `Transaction.currency_guid` MUST reference an existing commodity.
39. A transaction MUST have at least two splits.
40. All split accounts in a transaction MUST belong to one book.
41. Exact rational sum of split values MUST be zero.
42. `value_denom` and `quantity_denom` MUST be positive.
43. Deleting a transaction MUST delete its splits atomically.
44. Patching/deleting transactions linked to invoice/bill posting/payment flows MUST be rejected.

## Delete integrity

45. Deleting a book MUST be rejected while accounts, invoices/bills, customers, or vendors exist in that book.
46. Deleting a commodity MUST be rejected while referenced by accounts, transactions, customers, vendors, or invoices/bills.
47. Deleting an account MUST be rejected while it has children, splits, or invoice/bill entries.
48. When invoice/bill `id` is omitted or blank, server-side auto-numbering MUST reserve the next value atomically and avoid collisions under concurrent requests per `(book_id, owner_type)`.

## Authentication and authorization

49. User `email` MUST be unique after normalization (trim + lowercase).
50. Passwords MUST be persisted only as salted iterative hashes (plaintext storage is forbidden).
51. Bootstrap registration rule: when no users exist, the first registered user MUST be created as superuser.
52. After bootstrap, user registration MUST require an authenticated superuser.
53. `GET /auth/users` and user-book access management endpoints MUST require authenticated superuser.
54. For authenticated non-superusers, book-scoped reads MUST be rejected when there is no `UserBookAccess` for the target book.
55. For authenticated non-superusers, book-scoped writes MUST require `UserBookAccess.role = EDITOR`.
56. Superusers MUST bypass per-book access checks.
