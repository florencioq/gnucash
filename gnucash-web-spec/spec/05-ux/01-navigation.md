# 05.01 - UX: Navigation and Layout

## Primary navigation

- Primary application navigation MUST use grouped sections rather than a flat list.
- Navigation MUST use a left sidebar with section headers and nested items.
- Required sections and items:
  - `Operações`: Faturamentos, Compras, Contas a Receber, Contas a Pagar
  - `Contábil`: Razão
  - `Relatórios`: DRE Mensal, Prazo Quitação
  - `Cadastros`: Livros, Moedas, Contas, Clientes, Fornecedores
  - `Administração`: Usuários (superuser only)
- Section order MUST be: Operações → Contábil → Relatórios → Cadastros → Administração.
- Sidebar MUST support a collapsed mode with icon-only actions that remain fully clickable.
- Sidebar collapsed mode MUST have feature parity with expanded mode (navigation behavior must be identical).

## Dynamic tabs

- Detail views (individual Fatura, Compra) and primary screens (DRE, Razão, Faturamentos,
  Compras, Contas a Receber, Contas a Pagar) MUST render as dynamic closable tabs in a
  secondary row/panel, separate from the primary sidebar navigation.
- Sidebar entries for DRE Mensal, Razão, Faturamentos, Compras, Contas a Receber, and
  Contas a Pagar MUST open or focus their respective tab in the secondary panel and MUST NOT
  implicitly close other open tabs.
- Navigating from a dynamic detail tab back to its originating list view (Faturamentos / Compras)
  MUST close the originating detail tab to avoid stale "Novo ..." tabs lingering in list context.
- Dynamic tabs MUST persist after browser refresh within the same session.
- Open dynamic tabs MUST preserve mounted UI state (filters, form context, local view state)
  while the session remains active.
- Detail tab labels MUST prefer business document numbers (invoice/bill id); GUID fallback is
  only acceptable when the document number is unavailable.
- Repeated open/focus commands for the same tab and same context MUST be treated as no-op
  updates (idempotent).
- `Nova Fatura` and `Nova Compra` detail tabs MUST open with clean state and MUST NOT render
  stale header/line data from previously selected documents.
- Deleting an invoice/bill document MUST require explicit user confirmation and MUST close the
  corresponding dynamic detail tab after successful deletion.
