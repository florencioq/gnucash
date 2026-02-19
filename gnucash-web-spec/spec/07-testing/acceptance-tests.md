# 07 - Acceptance Tests

## Execution model

Acceptance coverage is distributed across backend test modules (not a single file).
Primary suites:
- `test_acceptance_spec.py`
- `test_auth.py`
- `test_books.py`
- `test_commodities.py`
- `test_accounts.py`
- `test_parties.py`
- `test_invoices.py`
- `test_bills.py`
- `test_transactions.py`
- `test_reports.py`
- `test_seed_data.py`

## Core scenarios

1. Create/list books.
2. Switch active book and enforce single active constraint.
3. Reject deactivating the only active book.
4. Validate book setup account fields (`default_payables_account_guid`, `default_receivables_account_guid`, `default_iss_recoverable_account_guid`) for type/same-book/non-placeholder constraints.
5. Reject invalid book setup when ISS recoverable account equals receivables account.
6. Create commodity and list by namespace.
7. Reject duplicated `(namespace,mnemonic)`.
8. Create root and child accounts.
9. Enforce same-book parent rule.
10. Reject hierarchy cycles.
11. Return account tree ordered by sibling name.
12. Expose `code`, `balance_num`, `balance_denom` in account tree.
13. Reject deleting account with children.
14. Reject deleting account/commodity in use.

## Auth and user-access scenarios

15. Auth register/login/me/refresh flow with normalized email and token issuance.
16. `AUTH_REQUIRED=true` blocks protected routes without bearer token.
17. First user bootstrap is auto-superuser and subsequent unauthenticated register is rejected.
18. Post-bootstrap user registration requires superuser token.
19. `GET /auth/users` rejects non-superuser caller.
20. Book-scoped access: non-granted user gets `FORBIDDEN_BOOK`.
21. Grant `VIEWER` allows read and still blocks write.
22. Grant `EDITOR` allows write for the granted book only.
23. Book/commodity mutations reject non-superuser callers.

## Parties scenarios

24. Customer CRUD and list by book.
25. Vendor CRUD and list by book.
26. Reject customer creation with invalid book/currency.
27. Reject vendor creation with invalid book/currency.
28. Validate customer default income account constraints.
29. Validate vendor default expense account constraints.
30. Reject deleting referenced commodity or book.

## Transaction scenarios

31. Create/get balanced transaction with splits.
32. Reject unbalanced transaction.
33. Reject cross-book split transactions.
34. List transactions by book.
35. Patch transaction replacing splits.
36. Reject patch/delete for invoice-linked transactions.

## Invoice scenarios

37. Invoice CRUD with entries.
38. Invoice validation rules (book/currency/customer/account constraints).
39. Invoice posting and unposting flow.
40. Invoice retained-tax posting flow requiring retained tax account and reduced initial open amount.
41. Invoice payment partial/full flow and payment undo.
42. Reject invoice unpost when posting lot has payment splits.
43. Reject deleting posted invoice.

## Bill scenarios

44. Bill CRUD with entries.
45. Bill posting and unposting flow.
46. Bill payment partial/full flow and payment undo.
47. Reject deleting vendor with existing bills.
48. Invoice paginated summary listing (`/invoices/list`) with filters/sort/page metadata.
49. Bill paginated summary listing (`/bills/list`) with filters/sort/page metadata.
50. Invoice list `payment_filter=OPEN` returns only documents with non-zero open amount.
51. Bill list `payment_filter=OPEN` returns only documents with non-zero open amount.

## Reporting scenarios

52. Income statement monthly summary.
53. Income statement account drill-down.
54. Income statement matrix by month and account.
55. Invoice settlement-by-customer report includes paid and open invoices with day-difference logic.
56. Reject invalid month ranges and invalid drill-down account type.
57. Reject invalid posted date ranges for settlement-by-customer report.

## Seed scenarios

58. Seed minimum data creates required entities.
59. Seed minimum data is idempotent.

## Document numbering scenarios

60. Invoice auto-numbering syncs with manual high IDs (blank-ID create after manual high ID returns next value).
61. Bill auto-numbering syncs with manual high IDs (blank-ID create after manual high ID returns next value).
62. Vendor master create/edit workflow via modal dialog (open, save, cancel, close behavior).
63. Vendor master list name search + active/inactive filter interaction.
64. Vendor master list name sorting toggle and UI pagination behavior.
65. Account master create/edit workflow via modal dialog (open, save, cancel, close behavior).
66. Account master tree name search/filter behavior (hierarchy preserved for matching branches).
67. Account master tree shows hierarchical consolidated balances for parent and placeholder nodes.
68. Account master tree row readability: right-aligned balance column, constrained width, and subtle row separators preserve account-to-action association.
