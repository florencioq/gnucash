# 05.05 - UX: Reports

## DRE Mensal (Income Statement Matrix)

- `Resultado Líquido` MUST be rendered as the first row of the matrix, above `Receita` and
  `Despesa`.
- Period column headers MUST render date ranges using `a` between start and end dates
  (e.g. `01/02/2026 a 28/02/2026`).

## Prazo Quitação (Settlement by Customer)

- Prazo Quitação screen MUST consume `/reports/invoices/settlement-by-customer` with
  server-side filtering, sorting, and pagination.
