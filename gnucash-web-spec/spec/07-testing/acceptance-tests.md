# 07 - Acceptance Tests

## Execution model

Acceptance coverage is distributed across backend test modules (not a single file).
Primary suites:
- `test_acceptance_spec.py`
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

## Parties scenarios

13. Customer CRUD and list by book.
14. Vendor CRUD and list by book.
15. Reject customer creation with invalid book/currency.
16. Reject vendor creation with invalid book/currency.
17. Reject deleting referenced commodity or book.

## Transaction scenarios

18. Create/get balanced transaction with splits.
19. Reject unbalanced transaction.
20. Reject cross-book split transactions.
21. List transactions by book.
22. Patch transaction replacing splits.
23. Reject patch/delete for invoice-linked transactions.

## Invoice scenarios

24. Invoice CRUD with entries.
25. Invoice validation rules (book/currency/customer/account constraints).
26. Invoice posting and unposting flow.
27. Invoice payment partial/full flow and payment undo.
28. Reject invoice unpost when posting lot has payment splits.
29. Reject deleting posted invoice.

## Bill scenarios

30. Bill CRUD with entries.
31. Bill posting and unposting flow.
32. Bill payment partial/full flow and payment undo.
33. Reject deleting vendor with existing bills.
34. Invoice paginated summary listing (`/invoices/list`) with filters/sort/page metadata.
35. Bill paginated summary listing (`/bills/list`) with filters/sort/page metadata.

## Reporting scenarios

36. Income statement monthly summary.
37. Income statement account drill-down.
38. Income statement matrix by month and account.
39. Reject invalid month ranges and invalid drill-down account type.

## Seed scenarios

40. Seed minimum data creates required entities.
41. Seed minimum data is idempotent.

## Document numbering scenarios

42. Invoice auto-numbering syncs with manual high IDs (blank-ID create after manual high ID returns next value).
43. Bill auto-numbering syncs with manual high IDs (blank-ID create after manual high ID returns next value).
