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
