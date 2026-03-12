# 05.02 - UX: Operational Screens (Invoicing and Purchasing)

## Layout and navigation structure

- Invoicing and purchasing pages MUST use a wider layout for dense editing.
- Navigation MUST be split into list (Faturamentos / Compras) and detail (Fatura / Compra) views.
- "Novo" actions (Nova Fatura / Nova Compra) MUST be initiated from list views, not from detail
  views.

## Lists

- Invoicing and purchasing lists MUST use server-side pagination via `/invoices/list` and
  `/bills/list` with filtering and sorting parameters.
- List views MUST support filtering, sortable columns, and open-to-detail navigation actions.
- Lists MUST render a `Vencimento` (`date_due`) column and MUST allow sort by due date.
- Lists MUST persist filter/sort/page state when the user switches tabs and after browser refresh
  within the same session.
- Pagination controls MUST include first/previous/next/last navigation and configurable page
  size options.
- List fallback labels for missing owner references MUST be explicit
  (e.g. `cliente não encontrado` / `fornecedor não encontrado`).

## Entry forms

- Invoicing entry editor MUST start with no revenue account selected; the user MUST choose
  `income_account_guid` explicitly.
- Purchasing entry editor MUST start with no expense account selected; the user MUST choose
  `income_account_guid` explicitly.
- Invoicing entry forms SHOULD auto-suggest the customer's default revenue account when
  available.
- Purchasing entry forms SHOULD auto-suggest the vendor's default expense account when
  available.
- Revenue/expense account selectors in entry editors MUST prioritize leaf-first path labels
  (`account / parent / ...`) and MUST provide wider input columns to keep leaf names visible.
- Posted invoices/bills MUST lock all line mutations until unposted.
- Invoicing MUST expose explicit post/unpost and payment undo actions.
- Invoicing line editor MUST treat tax amount as informational/included value while
  retained-at-source behavior is resolved during posting and open-balance calculation.

## Posting forms

- Invoicing and purchasing posting forms MUST expose editable due-date inputs, defaulting to
  posting date.
- Invoicing posting form SHOULD auto-suggest the book's default receivables account when
  available.
- Invoicing posting form SHOULD auto-suggest the book's default ISS recoverable account when
  retained tax is present.

## Payment forms

- Payment account selection MUST use hierarchical account pickers.
- In Compras, the payment form SHOULD auto-suggest the payment account from the most recent
  prior payment of the same vendor, when a valid account is available and differs from the bill
  posting account.

## Contas a Receber / Contas a Pagar

- Contas a Receber MUST consume `/invoices/list` with `posted_filter=POSTED` and
  `payment_filter=OPEN`, and MUST expose direct navigation links to each faturamento.
- Contas a Pagar MUST consume `/bills/list` with `posted_filter=POSTED` and
  `payment_filter=OPEN`, and MUST expose direct navigation links to each compra.

## PDF export

- The Compra detail view MUST expose a `⬇ PDF` action whenever a bill is selected.
- The generated PDF MUST use portrait orientation and MUST include:
  - A header section with: book name, bill number, vendor name, date opened, date posted,
    due date, status, and notes (when present).
  - An items table with columns: date, description, expense account, quantity, unit price,
    discount, subtotal, tax, and total.
  - A totals line with total amount and open balance.
  - A payments table (when payments exist) with columns: date, account, memo, and amount.
- The PDF file MUST be saved as `compra-{id}-{YYYY-MM-DD}.pdf`.

## Refresh

- Faturamentos, Compras, Contas a Receber, and Contas a Pagar screens MUST expose an
  explicit `Atualizar` action to force data refresh on demand.
