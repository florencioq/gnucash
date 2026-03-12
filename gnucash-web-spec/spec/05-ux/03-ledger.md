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

## Date range filter

- Razão MUST expose a `Data inicial` and `Data final` date input, rendered inline alongside
  the account selector, to restrict visible rows to a date range.
- Both inputs are optional; when empty, no date restriction is applied.
- Filtering MUST be applied client-side over the full account transaction set after the
  running balance is computed, so that the `Saldo` column reflects the real cumulative
  account balance at each point in time (including transactions prior to the filter range).
- Changing either date input MUST reset pagination to page 1.
- When at least one date is set, a `Limpar filtro` action MUST be visible to clear both inputs.

## Refresh

- Razão screen MUST expose an explicit `Atualizar` action to force data refresh on demand.
