# 07 - Acceptance Tests

## Execution model

Acceptance coverage is distributed across backend test modules (not a single file).
Primary suites:
- `test_acceptance_spec.py` — cenários de fumaça end-to-end mapeados à spec
- `test_auth.py` — autenticação e RBAC geral
- `test_rbac.py` — RBAC por livro para invoices, bills, transactions e reports
- `test_books.py`
- `test_commodities.py`
- `test_accounts.py`
- `test_parties.py`
- `test_invoices.py`
- `test_bills.py`
- `test_transactions.py`
- `test_reports.py`
- `test_seed_data.py`

UX scenarios (62–88) are **not yet automated**; they are tracked as manual acceptance criteria pending E2E tooling (Playwright or equivalent).

---

## Core scenarios

1. Create/list books. → `test_acceptance_spec.py::test_scenario_1_create_and_list_book`
2. Switch active book and enforce single active constraint. → `test_books.py::test_switch_active_book`
3. Reject deactivating the only active book. → `test_books.py::test_reject_deactivating_only_active_book`
4. Validate book setup account fields (`default_payables_account_guid`, `default_receivables_account_guid`, `default_iss_recoverable_account_guid`) for type/same-book/non-placeholder constraints. → `test_books.py::test_patch_book_setup_accounts_validation`
5. Reject invalid book setup when ISS recoverable account equals receivables account. → `test_books.py::test_patch_book_setup_accounts_validation`
6. Create commodity and list by namespace. → `test_acceptance_spec.py::test_scenario_2_create_brl_commodity`
7. Reject duplicated `(namespace,mnemonic)`. → `test_commodities.py::test_unique_namespace_mnemonic`
8. Create root and child accounts. → `test_acceptance_spec.py::test_scenario_7_list_accounts_by_book`
9. Enforce same-book parent rule. → `test_accounts.py::test_account_tree_and_same_book_parent_rule`
10. Reject hierarchy cycles. → `test_acceptance_spec.py::test_scenario_6_prevent_hierarchy_cycles`
11. Return account tree ordered by sibling name. → `test_acceptance_spec.py::test_scenario_8_retrieve_tree_ordered_by_name`
12. Expose `code`, `balance_num`, `balance_denom` in account tree. → `test_transactions.py::test_account_tree_includes_code_and_balance`
13. Reject deleting account with children. → `test_accounts.py::test_delete_restriction_account_with_children`
14. Reject deleting account/commodity in use. → `test_transactions.py::test_cannot_delete_account_or_commodity_in_use_by_transactions`

## Auth and user-access scenarios

15. Auth register/login/me/refresh flow with normalized email and token issuance. → `test_auth.py::test_auth_register_login_me_refresh_flow`
16. `AUTH_REQUIRED=true` blocks protected routes without bearer token. → `test_auth.py::test_auth_required_blocks_protected_routes_without_token`
17. First user bootstrap is auto-superuser and subsequent unauthenticated register is rejected. → `test_auth.py::test_register_requires_superuser_after_bootstrap`
18. Post-bootstrap user registration requires superuser token. → `test_auth.py::test_register_requires_superuser_after_bootstrap`
19. `GET /auth/users` rejects non-superuser caller. → `test_auth.py::test_list_users_requires_access_token`
20. Book-scoped access: non-granted user gets `FORBIDDEN_BOOK` on invoices, bills, transactions and reports. → `test_rbac.py::test_no_book_access_blocks_reads_on_invoices_bills_transactions_reports`; `test_auth.py::test_book_access_roles_and_superuser_rules`
21. Grant `VIEWER` allows read and still blocks write on invoices, bills and transactions. → `test_rbac.py::test_viewer_can_read_but_not_write_invoices`, `test_viewer_can_read_but_not_write_bills`, `test_viewer_can_read_but_not_write_transactions`, `test_viewer_can_read_reports`; `test_auth.py::test_book_access_roles_and_superuser_rules`
22. Grant `EDITOR` allows write for the granted book only. → `test_rbac.py::test_editor_can_write_invoices_bills_and_transactions`; `test_auth.py::test_book_access_roles_and_superuser_rules`
23. Book/commodity mutations reject non-superuser callers. → `test_auth.py::test_book_access_roles_and_superuser_rules`

## Parties scenarios

24. Customer CRUD and list by book. → `test_parties.py::test_customer_crud_and_list_by_book`
25. Vendor CRUD and list by book. → `test_parties.py::test_vendor_crud_and_list_by_book`
26. Reject customer creation with invalid book/currency. → `test_parties.py::test_customer_requires_existing_book_and_currency`
27. Reject vendor creation with invalid book/currency. → `test_parties.py::test_vendor_requires_existing_book_and_currency`
28. Validate customer default income account constraints. → `test_parties.py::test_customer_default_income_account_validation`
29. Validate vendor default expense account constraints. → `test_parties.py::test_vendor_default_expense_account_validation`
30. Reject deleting referenced commodity or book. → `test_parties.py::test_cannot_delete_referenced_commodity_or_book`

## Transaction scenarios

31. Create/get balanced transaction with splits. → `test_transactions.py::test_create_and_get_transaction_with_balanced_splits`
32. Reject unbalanced transaction. → `test_transactions.py::test_reject_unbalanced_transaction`
33. Reject cross-book split transactions. → `test_transactions.py::test_reject_transaction_with_accounts_from_different_books`
34. List transactions by book. → `test_transactions.py::test_list_transactions_by_book`
35. Patch transaction replacing splits. → `test_transactions.py::test_patch_transaction_replaces_splits`
36. Reject patch/delete for invoice-linked transactions. → `test_invoices.py::test_invoice_post_and_unpost_flow`; `test_bills.py::test_bill_post_payment_and_undo_flow`

## Invoice scenarios

37. Invoice CRUD with entries. → `test_invoices.py::test_invoice_crud_and_entries`
38. Invoice validation rules (book/currency/customer/account constraints). → `test_invoices.py::test_invoice_validation_rules`
39. Invoice posting and unposting flow. → `test_invoices.py::test_invoice_post_and_unpost_flow`
40. Invoice retained-tax posting flow requiring retained tax account and reduced initial open amount. → `test_invoices.py::test_invoice_post_with_retained_tax_reduces_receivable_open_amount`
41. Invoice payment partial/full flow and payment undo. → `test_invoices.py::test_invoice_payment_partial_and_undo_flow`
42. Reject invoice unpost when posting lot has payment splits. → `test_invoices.py::test_invoice_unpost_rejected_when_lot_has_payment_split`
43. Reject deleting posted invoice. → `test_invoices.py::test_invoice_post_and_unpost_flow`

## Bill scenarios

44. Bill CRUD with entries. → `test_bills.py::test_bill_crud_and_entries`
45. Bill posting and unposting flow. → `test_bills.py::test_bill_post_payment_and_undo_flow`
46. Bill payment partial/full flow and payment undo. → `test_bills.py::test_bill_post_payment_and_undo_flow`
47. Reject deleting vendor with existing bills. → `test_bills.py::test_vendor_delete_rejected_when_has_bills`
48. Invoice paginated summary listing (`/invoices/list`) with filters/sort/page metadata. → `test_invoices.py::test_invoice_list_paginated_summary`
49. Bill paginated summary listing (`/bills/list`) with filters/sort/page metadata. → `test_bills.py::test_bill_list_paginated_summary`
50. Invoice list `payment_filter=OPEN` returns only documents with non-zero open amount. → `test_invoices.py::test_invoice_list_open_payment_filter`
51. Bill list `payment_filter=OPEN` returns only documents with non-zero open amount. → `test_bills.py::test_bill_list_open_payment_filter`

## Reporting scenarios

52. Income statement monthly summary. → `test_reports.py::test_income_statement_report_monthly_summary`
53. Income statement account drill-down. → `test_reports.py::test_income_statement_entries_drilldown`
54. Income statement matrix by month and account. → `test_reports.py::test_income_statement_matrix_by_month_and_account`
55. Invoice settlement-by-customer report includes paid and open invoices with day-difference logic. → `test_reports.py::test_invoice_settlement_by_customer_report`
56. Reject invalid month ranges and invalid drill-down account type. → `test_reports.py::test_income_statement_entries_drilldown`; `test_reports.py::test_income_statement_matrix_by_month_and_account`
57. Reject invalid posted date ranges for settlement-by-customer report. → `test_reports.py::test_invoice_settlement_by_customer_report_invalid_date_range`

## Seed scenarios

58. Seed minimum data creates required entities. → `test_seed_data.py::test_seed_minimum_data_creates_required_entities`
59. Seed minimum data is idempotent. → `test_seed_data.py::test_seed_minimum_data_is_idempotent`

## Document numbering scenarios

60. Invoice auto-numbering syncs with manual high IDs (blank-ID create after manual high ID returns next value). → `test_invoices.py::test_invoice_autonumber_tracks_manual_high_id_after_counter_exists`
61. Bill auto-numbering syncs with manual high IDs (blank-ID create after manual high ID returns next value). → `test_bills.py::test_bill_autonumber_tracks_manual_high_id_after_counter_exists`

## Data isolation scenarios

62-backend. Invoice list endpoints return only invoices belonging to the queried book. → `test_invoices.py::test_invoice_list_isolated_by_book`
63-backend. Bill list endpoints return only bills belonging to the queried book. → `test_bills.py::test_bill_list_isolated_by_book`
64-backend. Transaction list ordering: `post_date ASC`, tie-break by `enter_date ASC`. → `test_transactions.py::test_transactions_ordered_by_post_date_then_enter_date`

## UX / frontend scenarios

> **Status: not yet automated.** The scenarios below are manual acceptance criteria. Automated E2E coverage (Playwright or equivalent) is planned but not yet implemented.

62. Vendor master create/edit workflow via modal dialog (open, save, cancel, close behavior).
63. Vendor master list name search + active/inactive filter interaction.
64. Vendor master list name sorting toggle and UI pagination behavior.
65. Account master create/edit workflow via modal dialog (open, save, cancel, close behavior).
66. Account master tree name search/filter behavior (hierarchy preserved for matching branches).
67. Account master tree shows hierarchical consolidated balances for parent and placeholder nodes.
68. Account master tree row readability: right-aligned balance column, constrained width, and subtle row separators preserve account-to-action association.
69. Sidebar operational/report entries (`DRE Mensal`, `Razão`, `Faturamentos`, `Compras`, `Contas a Receber`, `Contas a Pagar`) open/focus dynamic tabs without clearing other open tabs.
70. Switching between open dynamic tabs preserves in-session UI context/state (for example filters and editor context) instead of reinitializing each view.
71. Dynamic workspace/report tabs persist after browser refresh in-session and remain individually closable.
72. Explicit `Atualizar` actions in `Razão`, `Faturamentos`, `Compras`, `Contas a Receber`, and `Contas a Pagar` trigger on-demand reload without closing active tabs.
73. DRE monthly matrix period header uses `a` (not `para`) between start/end dates.
74. `Razão` counterparty column provides direct navigation link to open the ledger of the selected `Contra-partida` account.
75. After switching ledger account via `Contra-partida` link, browser refresh restores the same selected account in `Razão`.
76. `Razão` amount column headers are rendered as `Saque` and `Depósito`.
77. Clicking an account drill-down in `DRE Mensal` opens/focuses `Razão` exactly once and keeps the selected account stable (no tab/account oscillation) until the next user action.
78. Re-triggering the same `DRE Mensal` drill-down for the same account does not duplicate report tabs and does not cause visible UI oscillation.
79. When `Razão` emits a selected-account synchronization event with value equivalent to current app state, no global navigation-state mutation occurs.
80. Inactive dynamic tabs do not emit side effects that change active tab or selected account context.
81. In `Compras`, payment account default suggestion uses the most recent prior payment account of the same vendor when a valid account exists.
82. Invoice posting without explicit `due_date` sets `date_due` equal to `post_date`. → `test_invoices.py::test_invoice_post_and_unpost_flow` (backend), UX pending
83. Bill posting without explicit `due_date` sets `date_due` equal to `post_date`. → `test_bills.py::test_bill_post_payment_and_undo_flow` (backend), UX pending
84. Invoice/bill list endpoints support due-date ordering (`sort_key=date_due`) with returned `date_due` values. → `test_bills.py::test_bill_post_payment_and_undo_flow` (backend partial), UX pending
85. Unposting invoice/bill clears `date_due` in document payloads. → `test_invoices.py::test_invoice_post_and_unpost_flow`; `test_bills.py::test_bill_post_payment_and_undo_flow` (backend), UX pending
86. Account master tree supports account-type filtering (`ASSET`, `LIABILITY`, `INCOME`, `EXPENSE`, `EQUITY`) with default "all types" behavior and preserved hierarchy for matching branches.
87. Account master tree keeps visibility filtering active when combined with account-type filter (for example: selecting `ASSET` while `Ocultar contas com saldo zerado` and/or `Ocultar contas sem lançamentos` is enabled still prunes matching leaf nodes correctly), including nested-branch pruning where ancestors MUST keep already-pruned descendants hidden (no child/grandchild reappearance after recursive traversal).
88. `Razão` ordering uses movement date (`post_date` fallback `enter_date`); when multiple entries share the same date, the list preserves posting sequence by `enter_date` (stable tie-break, not GUID-based random ordering). → `test_transactions.py::test_transactions_ordered_by_post_date_then_enter_date` (backend), UX pending
