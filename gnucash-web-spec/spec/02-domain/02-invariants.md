# 02.02 - Invariants

## General

1. IDs exposed in API MUST be UUID-formatted strings.
2. Timestamps MUST be UTC and serialized in RFC3339 (`...Z`).
3. Validation/invariant errors MUST return structured payload (`code`, `message`, `details`).

## Books

4. If books exist, there MUST be at least one active book.
5. Activating one book MUST deactivate all other books.
6. Deleting an active book MUST promote another existing book to active when possible.
7. `default_payables_account_guid`, when set, MUST reference a same-book non-placeholder `LIABILITY` account.
8. `default_receivables_account_guid`, when set, MUST reference a same-book non-placeholder `ASSET` account.
9. `default_iss_recoverable_account_guid`, when set, MUST reference a same-book non-placeholder `ASSET` account.
10. `default_iss_recoverable_account_guid`, when set together with `default_receivables_account_guid`, MUST be different from it.

## Commodity

11. `(namespace, mnemonic)` MUST be unique.
12. `fraction` MUST be a positive integer.

## Accounts and hierarchy

13. `Account.book_id` MUST reference an existing `Book`.
14. `Account.commodity_id` MUST reference an existing `Commodity`.
15. `Account.type` MUST be one of `ROOT|ASSET|LIABILITY|INCOME|EXPENSE|EQUITY`.
16. `ROOT` accounts MUST have `parent_id = null`.
17. Non-`ROOT` accounts MUST have `parent_id != null`.
18. `parent_id`, when present, MUST reference an account in the same `book_id`.
19. Account hierarchy MUST be acyclic.
20. Account cannot be its own parent.

## Customers and vendors

21. `Customer.book_id` and `Vendor.book_id` MUST reference an existing `Book`.
22. `Customer.currency_guid` and `Vendor.currency_guid` MUST reference an existing `Commodity`.
23. `Customer.income_account_guid`, when set, MUST reference a same-book non-placeholder `INCOME` account.
24. `Vendor.expense_account_guid`, when set, MUST reference a same-book non-placeholder `EXPENSE` account.
25. Customer/vendor deletion MUST be rejected while referenced by invoice/bill owners.

## Invoices and bills

26. `invoices.owner_type` MUST be `CUSTOMER` or `VENDOR` for API-managed records.
27. For `owner_type=CUSTOMER`, `owner_guid` MUST reference an existing customer in the same book.
28. For `owner_type=VENDOR`, `owner_guid` MUST reference an existing vendor in the same book.
29. `currency_guid` MUST reference an existing commodity.
30. `date_posted` is read-only via header patch and is controlled by post/unpost operations.
31. Posted invoices/bills MUST block structural header edits until unposted.
32. Deleting posted invoices/bills MUST be rejected.
33. Entry create/patch/delete MUST be rejected for posted invoices/bills.

## Posting and payments

34. Invoice post account MUST be same-book, non-placeholder, `ASSET`, and currency-compatible.
35. Bill post account MUST be same-book, non-placeholder, `LIABILITY`, and currency-compatible.
36. Posting requires at least one entry and non-zero total.
37. Posting MUST create balanced splits and posting lot metadata (`post_txn`, `post_lot`, `post_acc`).
38. Invoice posting with non-zero retained tax amount MUST require `retained_tax_account_guid`.
39. `retained_tax_account_guid`, when provided, MUST be same-book, non-placeholder, `ASSET`, currency-compatible, and different from posting account.
40. When retained tax is posted at source, invoice open amount SHOULD be reduced at posting time (`status=PARTIAL` until payment settlement).
41. Unpost MUST remove posting transaction and clear posting metadata.
42. Unpost MUST be rejected when payment splits still exist in posting lot.
43. Payment requires posted invoice/bill and existing posting lot/account consistency.
44. Payment transfer account MUST be same-book, non-placeholder, not `ROOT`, currency-compatible, and different from posting account.
45. Payment amount MUST be positive and MUST NOT exceed lot open balance.
46. Payment undo MUST reject posting transaction and only accept transactions tied to the document lot.

## Transactions and splits

47. `Transaction.currency_guid` MUST reference an existing commodity.
48. A transaction MUST have at least two splits.
49. All split accounts in a transaction MUST belong to one book.
50. Exact rational sum of split values MUST be zero.
51. `value_denom` and `quantity_denom` MUST be positive.
52. Deleting a transaction MUST delete its splits atomically.
53. Patching/deleting transactions linked to invoice/bill posting/payment flows MUST be rejected.

## Delete integrity

54. Deleting a book MUST be rejected while accounts, invoices/bills, customers, or vendors exist in that book.
55. Deleting a commodity MUST be rejected while referenced by accounts, transactions, customers, vendors, or invoices/bills.
56. Deleting an account MUST be rejected while it has children, splits, or invoice/bill entries.
57. When invoice/bill `id` is omitted or blank, server-side auto-numbering MUST reserve the next value atomically and avoid collisions under concurrent requests per `(book_id, owner_type)`.

## Authentication and authorization

58. User `email` MUST be unique after normalization (trim + lowercase).
59. Passwords MUST be persisted only as salted iterative hashes (plaintext storage is forbidden).
60. Bootstrap registration rule: when no users exist, the first registered user MUST be created as superuser.
61. After bootstrap, user registration MUST require an authenticated superuser.
62. `GET /auth/users` and user-book access management endpoints MUST require authenticated superuser.
63. For authenticated non-superusers, book-scoped reads MUST be rejected when there is no `UserBookAccess` for the target book.
64. For authenticated non-superusers, book-scoped writes MUST require `UserBookAccess.role = EDITOR`.
65. Superusers MUST bypass per-book access checks.
