# 05.03 - UX: Ledger (Razão)

## Ordering

- Ledger MUST default to newest-first chronological order and MUST allow switching to
  oldest-first.
- Row ordering MUST use movement date (`post_date`, fallback `enter_date`).
- For same-day entries, ordering MUST preserve posting sequence using `enter_date`; random
  identifiers such as GUID MUST NOT be used as tiebreakers.

## Pagination

- Ledger MUST support pagination controls (first/previous/next/last + page size options).
- Default page size MUST be 10 items.

## Display

- Amount column headers MUST use `Saque` and `Depósito`.
- Ledger MUST expose clickable `Contra-partida` account links that switch the current Razão
  view directly to the selected counterparty account.
- Rows linked to invoice/bill workflows MUST NOT expose edit/delete actions; users MUST
  perform those operations in Faturamentos or Compras.

## Session persistence

- Selected account context MUST be persisted in-session so that browser refresh restores the
  most recently selected account, including changes performed via counterparty links.

## Refresh

- Razão screen MUST expose an explicit `Atualizar` action to force data refresh on demand.
