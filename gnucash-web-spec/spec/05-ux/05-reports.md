# 05.05 - UX: Reports

## DRE Mensal (Income Statement Matrix)

- `Resultado Líquido` MUST be rendered as the first row of the matrix, above `Receita` and
  `Despesa`.
- Period column headers MUST render date ranges using `a` between start and end dates
  (e.g. `01/02/2026 a 28/02/2026`).

## Prazo Quitação (Settlement by Customer)

- Prazo Quitação screen MUST consume `/reports/invoices/settlement-by-customer` with
  server-side filtering, sorting, and pagination.

## Painel Financeiro (Financial Dashboard)

- Painel Financeiro is accessible to superusers only.
- Screen MUST display a year selector (integer input, default = current year).
- Screen MUST consume `GET /reports/financial-dashboard?book_id=&year=YYYY` and render the
  following KPI cards:
  - **Receita Líquida** — annual revenue for the selected year.
  - **Crescimento em Todos os Trimestres** — banner card; MUST show a positive growth
    callout (dark-blue background, up arrow) when `all_quarters_positive` is `true`; otherwise
    MUST show a neutral callout indicating how many of the 4 quarters had positive net income.
  - **Resultado Líquido** — annual net income (revenue minus expenses).
  - **Margem Líquida** — `margin_percent` formatted as a percentage; displayed as `—` when
    revenue is zero.
  - **Total Despesas** — annual expenses.
  - **Variação Anual** — `annual_growth_percent` formatted as a signed percentage; subtitled
    with the previous year's net income.
- Monetary values MUST be rendered with the currency symbol extracted from
  `currency_mnemonic` and abbreviated with the appropriate Portuguese scale label:
  `Bilhão` (singular, < 2 × 10⁹) / `Bilhões` (plural, ≥ 2 × 10⁹),
  `Milhão` (singular, < 2 × 10⁶) / `Milhões` (plural, ≥ 2 × 10⁶),
  `Mil` (≥ 10³, invariable).
- A quarterly breakdown row MUST be rendered below the KPI grid, showing 4 cards
  (1º Tri through 4º Tri) each with net income, revenue, expenses, and quarter-over-quarter
  growth percentage versus the same quarter of the previous year.
- An `Atualizar` button MUST trigger a fresh API call.

## Pagamentos por Conta

- Screen opens as a closable dynamic tab in the Relatórios section of the sidebar.
- Filters (persisted in session storage):
  - **Contas devedoras na postagem (despesa)** — required multi-select account tree picker; user must select at least one account before searching.
  - **Contas de pagamento** — required multi-select account tree picker; user must select at least one payment account before searching.
  - **Data início** / **Data fim** — optional date range filter applied to transaction date.
  - **Buscar** button — enabled only when at least one expense account and at least one payment account are selected; triggers API call.
- Results table columns: Data | Descrição | Conta de pagamento | Valor pago | Compra/Fatura | Memo | Ações.
  - **Compra/Fatura** — shows the linked bill or invoice number when the payment is associated with a known document; otherwise empty.
  - **Ações** — action links to navigate to the related document (e.g. open the bill/invoice tab).
- Pagination: server-side (`page` / `page_size`); default page size 25.
- A **⬇ PDF** button MUST be shown when the result set is non-empty; clicking it generates and downloads a landscape PDF containing:
  - Header metadata: book name, selected expense account(s), selected payment account(s), date range, total record count.
  - Table matching the screen columns (without Ações): Data | Descrição | Conta de pagamento | Valor pago | Compra/Fatura | Memo.
  - A bold total row at the bottom summing Valor pago.
  - Filename: `pagamentos-por-conta-YYYY-MM-DD.pdf` (today's date).
- Consumes `GET /reports/account-transfers` (see API spec).

## Transferências entre Contas

- Screen opens as a closable dynamic tab in the Relatórios section of the sidebar.
- Filters (persisted in session storage):
  - **Contas de origem** — required multi-select account tree picker; user must select at least one account before searching.
  - **Contas de destino** — optional multi-select account tree picker; when empty, all counterpart splits of source-account transactions are returned.
  - **Data início** / **Data fim** — optional date range filter applied to transaction date.
  - **Buscar** button — enabled only when at least one source account is selected; triggers API call.
- Results table columns: Data | Descrição | Conta(s) de Origem | Valor Origem | Conta(s) de Destino | Valor Destino | Memo | Ações.
  - **Conta(s) de Origem** — name(s) of the source account split(s) for the transaction.
  - **Conta(s) de Destino** — name(s) of the counterpart (destination) split(s); when destination filter is empty, shows all non-source splits.
  - **Ações** — action links to navigate to a related document when the transaction is linked to an invoice or bill.
- Pagination: server-side (`page` / `page_size`); default page size 25.
- A **⬇ PDF** button MUST be shown when the result set is non-empty; clicking it generates and downloads a landscape PDF containing:
  - Header metadata: book name, selected origin account(s), selected destination account(s), date range, total record count.
  - Table matching the screen columns (without Ações): Data | Descrição | Conta(s) de Origem | Valor Origem | Conta(s) de Destino | Valor Destino | Doc | Memo.
  - Both Valor Origem and Valor Destino columns MUST be right-aligned.
  - Filename: `transferencias-YYYY-MM-DD.pdf` (today's date).
- Consumes `GET /reports/transfers` (see API spec).
