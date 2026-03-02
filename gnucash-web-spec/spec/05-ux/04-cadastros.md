# 05.04 - UX: Cadastros (Accounts, Books, Customers, Vendors)

## Account tree

- Account tree MUST display hierarchical totals: parent balance aggregated from descendants;
  placeholder nodes aggregate children.
- Account tree MUST provide name-based search/filter over the rendered hierarchy.
- Account tree MUST provide account-type filter options (ASSET, LIABILITY, INCOME, EXPENSE,
  EQUITY) with a default "all types" state while preserving branch hierarchy for matching
  descendants.
- Account tree visibility options (`Ocultar contas com saldo zerado`,
  `Ocultar contas sem lançamentos`) MUST compose with name/type filters; applying a type filter
  MUST NOT disable visibility filtering behavior.
- Account tree rows MUST use a dedicated right-aligned balance column and subtle row
  separators so balance/actions remain visually associated with the corresponding account.
- Account tree container width SHOULD be constrained to avoid excessive horizontal spread
  between account labels and row actions.
- Account create/edit actions MUST open in modal dialogs.
- Hierarchical account pickers MUST hide the synthetic ROOT account node.
- Hierarchical account pickers SHOULD provide a tall viewport to improve deep-tree navigation.

## Books

- Books UI MUST expose active-book selection.
- Books UI MUST expose account selectors backed by hierarchical account trees for:
  - default payables account (`default_payables_account_guid`)
  - default receivables account (`default_receivables_account_guid`)
  - default ISS recoverable account (`default_iss_recoverable_account_guid`)

## Authentication and user administration

- Frontend MUST include a login screen and a protected navigation guard for all business routes.
- Frontend MUST include a user administration screen accessible only to superusers, supporting:
  - creating users
  - managing per-book access roles
- User administration screen MUST list existing per-book grants for each non-superuser and
  allow:
  - create/update a grant with role `VIEWER` or `EDITOR`
  - revoke a grant for a selected `(user, book)` pair

## Customers and Vendors

- Customer and vendor create/edit actions MUST open in modal dialogs.
- Customer and vendor master forms MUST expose default account selectors using hierarchical
  account trees.
- Vendor master list MUST provide name search, active/inactive status filter, a sortable name
  column, and UI pagination controls.
