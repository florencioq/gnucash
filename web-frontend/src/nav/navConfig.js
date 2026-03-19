// NAV_CONFIG — árvore de navegação da sidebar.
// Para adicionar uma nova página: inclua um item aqui + em baseTabs em App.jsx.

export const NAV_CONFIG = [
  {
    id: "operations",
    label: "Operações",
    icon: "📋",
    defaultOpen: true,
    items: [
      {
        id: "invoicing-list",
        label: "Faturamentos",
        icon: "🧾",
        sidebar: true,
        action: "navigate",
        tabId: "invoicing-list",
        children: [
          {
            id: "action:new-invoice",
            label: "Nova Fatura",
            icon: "➕",
            action: "createInvoicing",
            requiresActiveBook: true
          }
        ]
      },
      {
        id: "billing-list",
        label: "Compras",
        icon: "🛒",
        sidebar: true,
        action: "navigate",
        tabId: "billing-list",
        children: [
          {
            id: "action:new-bill",
            label: "Nova Compra",
            icon: "➕",
            action: "createBilling",
            requiresActiveBook: true
          }
        ]
      },
      {
        id: "receivables",
        label: "Contas a Receber",
        icon: "💰",
        sidebar: true,
        action: "navigate",
        tabId: "receivables"
      },
      {
        id: "payables",
        label: "Contas a Pagar",
        icon: "💸",
        sidebar: true,
        action: "navigate",
        tabId: "payables"
      }
    ]
  },
  {
    id: "accounting",
    label: "Contábil",
    icon: "📒",
    defaultOpen: true,
    items: [
      {
        id: "ledger",
        label: "Razão",
        icon: "📒",
        sidebar: true,
        action: "navigate",
        tabId: "ledger"
      }
    ]
  },
  {
    id: "reports",
    label: "Relatórios",
    icon: "📊",
    defaultOpen: false,
    items: [
      {
        id: "income-statement",
        label: "DRE Mensal",
        icon: "📈",
        sidebar: true,
        action: "navigate",
        tabId: "income-statement"
      },
      {
        id: "invoice-settlement-report",
        label: "Prazo Quitação",
        icon: "⏱",
        action: "navigate",
        tabId: "invoice-settlement-report"
      },
      {
        id: "account-transfers-report",
        label: "Pagamentos por Conta",
        icon: "🔄",
        action: "navigate",
        tabId: "account-transfers-report"
      },
      {
        id: "transfers-report",
        label: "Transferências",
        icon: "↔",
        action: "navigate",
        tabId: "transfers-report"
      },
      {
        id: "financial-dashboard",
        label: "Painel Financeiro",
        icon: "🏦",
        action: "navigate",
        tabId: "financial-dashboard"
      }
    ]
  },
  {
    id: "masters",
    label: "Cadastros",
    icon: "🗂",
    defaultOpen: false,
    items: [
      {
        id: "books",
        label: "Livros",
        icon: "📚",
        action: "navigate",
        tabId: "books"
      },
      {
        id: "commodities",
        label: "Moedas",
        icon: "💱",
        action: "navigate",
        tabId: "commodities"
      },
      {
        id: "accounts",
        label: "Saldos",
        icon: "🏦",
        sidebar: true,
        action: "navigate",
        tabId: "accounts"
      },
      {
        id: "customers",
        label: "Clientes",
        icon: "👥",
        action: "navigate",
        tabId: "customers"
      },
      {
        id: "vendors",
        label: "Fornecedores",
        icon: "🚚",
        action: "navigate",
        tabId: "vendors"
      }
    ]
  },
  {
    id: "administration",
    label: "Administração",
    icon: "🛡",
    defaultOpen: false,
    items: [
      {
        id: "profile",
        label: "Alterar Senha",
        icon: "🔐",
        action: "navigate",
        tabId: "profile"
      },
      {
        id: "users",
        label: "Usuários",
        icon: "🛡",
        action: "navigate",
        tabId: "users",
        requiresSuperuser: true
      }
    ]
  }
];
