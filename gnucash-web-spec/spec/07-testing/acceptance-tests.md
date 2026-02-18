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
4. Create commodity and list by namespace.
5. Reject duplicated `(namespace,mnemonic)`.
6. Create root and child accounts.
7. Enforce same-book parent rule.
8. Reject hierarchy cycles.
9. Return account tree ordered by sibling name.
10. Expose `code`, `balance_num`, `balance_denom` in account tree.
11. Reject deleting account with children.
12. Reject deleting account/commodity in use.

## Auth and user-access scenarios

13. Auth register/login/me/refresh flow with normalized email and token issuance.
14. `AUTH_REQUIRED=true` blocks protected routes without bearer token.
15. First user bootstrap is auto-superuser and subsequent unauthenticated register is rejected.
16. Post-bootstrap user registration requires superuser token.
17. `GET /auth/users` rejects non-superuser caller.
18. Book-scoped access: non-granted user gets `FORBIDDEN_BOOK`.
19. Grant `VIEWER` allows read and still blocks write.
20. Grant `EDITOR` allows write for the granted book only.
21. Book/commodity mutations reject non-superuser callers.

## Parties scenarios

22. Customer CRUD and list by book.
23. Vendor CRUD and list by book.
24. Reject customer creation with invalid book/currency.
25. Reject vendor creation with invalid book/currency.
26. Reject deleting referenced commodity or book.

## Transaction scenarios

27. Create/get balanced transaction with splits.
28. Reject unbalanced transaction.
29. Reject cross-book split transactions.
30. List transactions by book.
31. Patch transaction replacing splits.
32. Reject patch/delete for invoice-linked transactions.

## Invoice scenarios

33. Invoice CRUD with entries.
34. Invoice validation rules (book/currency/customer/account constraints).
35. Invoice posting and unposting flow.
36. Invoice payment partial/full flow and payment undo.
37. Reject invoice unpost when posting lot has payment splits.
38. Reject deleting posted invoice.

## Bill scenarios

39. Bill CRUD with entries.
40. Bill posting and unposting flow.
41. Bill payment partial/full flow and payment undo.
42. Reject deleting vendor with existing bills.
43. Invoice paginated summary listing (`/invoices/list`) with filters/sort/page metadata.
44. Bill paginated summary listing (`/bills/list`) with filters/sort/page metadata.
45. Invoice list `payment_filter=OPEN` returns only documents with non-zero open amount.
46. Bill list `payment_filter=OPEN` returns only documents with non-zero open amount.

## Reporting scenarios

47. Income statement monthly summary.
48. Income statement account drill-down.
49. Income statement matrix by month and account.
50. Reject invalid month ranges and invalid drill-down account type.

## Seed scenarios

51. Seed minimum data creates required entities.
52. Seed minimum data is idempotent.

## Document numbering scenarios

53. Invoice auto-numbering syncs with manual high IDs (blank-ID create after manual high ID returns next value).
54. Bill auto-numbering syncs with manual high IDs (blank-ID create after manual high ID returns next value).
