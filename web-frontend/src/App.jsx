import React, { useCallback, useEffect, useMemo, useState } from "react";
import BooksPage from "./pages/BooksPage.jsx";
import CommoditiesPage from "./pages/CommoditiesPage.jsx";
import AccountsPage from "./pages/AccountsPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";
import VendorsPage from "./pages/VendorsPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import LedgerPage from "./pages/LedgerPage.jsx";
import InvoicingListPage from "./pages/InvoicingListPage.jsx";
import InvoicingPage from "./pages/InvoicingPage.jsx";
import BillingListPage from "./pages/BillingListPage.jsx";
import BillingPage from "./pages/BillingPage.jsx";
import IncomeStatementPage from "./pages/IncomeStatementPage.jsx";
import InvoiceSettlementReportPage from "./pages/InvoiceSettlementReportPage.jsx";
import AccountTransfersReportPage from "./pages/AccountTransfersReportPage.jsx";
import TransfersBetweenAccountsPage from "./pages/TransfersBetweenAccountsPage.jsx";
import FinancialDashboardPage from "./pages/FinancialDashboardPage.jsx";
import ReceivablesPage from "./pages/ReceivablesPage.jsx";
import PayablesPage from "./pages/PayablesPage.jsx";
import ChangePasswordPage from "./pages/ChangePasswordPage.jsx";
import {
  api,
  apiBase,
  authSessionChangedEvent,
  clearAuthSession,
  getAuthSession
} from "./api/client.js";

const APP_VERSION = "v0.4.27";
const APP_RELEASE_DATE = "2026-03-13";

const APP_TABS_STATE_KEY = "gnucash.app-tabs-state.v1";
const NEW_INVOICE_TAB_GUID = "new";
const NEW_BILL_TAB_GUID = "new";
const DEFAULT_AUTH_TAB_ID = "income-statement";
const INCOME_STATEMENT_DETAIL_TAB_ID = "report:income-statement";
const LEDGER_DETAIL_TAB_ID = "report:ledger";
const ACCOUNT_TRANSFERS_DETAIL_TAB_ID = "report:account-transfers";
const TRANSFERS_DETAIL_TAB_ID = "report:transfers";
const WORKSPACE_DETAIL_TAB_BY_ID = {
  accounts: "workspace:accounts",
  receivables: "workspace:receivables",
  payables: "workspace:payables",
  "invoicing-list": "workspace:invoicing-list",
  "billing-list": "workspace:billing-list",
  customers: "workspace:customers",
  vendors: "workspace:vendors"
};

const baseTabs = [
  { id: "login", label: "Login", component: LoginPage },
  { id: "books", label: "Livros", component: BooksPage },
  { id: "commodities", label: "Moedas", component: CommoditiesPage },
  { id: "accounts", label: "Saldos", component: AccountsPage },
  { id: "customers", label: "Clientes", component: CustomersPage },
  { id: "vendors", label: "Fornecedores", component: VendorsPage },
  { id: "users", label: "Usuários", component: UsersPage },
  { id: "profile", label: "Alterar Senha", component: ChangePasswordPage },
  { id: "ledger", label: "Razão", component: LedgerPage },
  { id: "income-statement", label: "DRE Mensal", component: IncomeStatementPage },
  {
    id: "invoice-settlement-report",
    label: "Prazo Quitação",
    component: InvoiceSettlementReportPage
  },
  {
    id: "account-transfers-report",
    label: "Pagamentos por Conta",
    component: AccountTransfersReportPage
  },
  {
    id: "transfers-report",
    label: "Transferências",
    component: TransfersBetweenAccountsPage
  },
  { id: "financial-dashboard", label: "Painel Financeiro", component: FinancialDashboardPage },
  { id: "receivables", label: "Contas a Receber", component: ReceivablesPage },
  { id: "payables", label: "Contas a Pagar", component: PayablesPage },
  { id: "invoicing-list", label: "Faturamentos", component: InvoicingListPage },
  { id: "billing-list", label: "Compras", component: BillingListPage }
];

const primaryNavSectionsConfig = [
  {
    id: "operations",
    label: "Operações",
    itemIds: ["invoicing-list", "billing-list", "receivables", "payables"]
  },
  {
    id: "accounting",
    label: "Contábil",
    itemIds: ["ledger"]
  },
  {
    id: "reports",
    label: "Relatórios",
    itemIds: ["income-statement", "invoice-settlement-report", "account-transfers-report", "transfers-report", "financial-dashboard"]
  },
  {
    id: "masters",
    label: "Cadastros",
    itemIds: ["books", "commodities", "accounts", "customers", "vendors"]
  },
  {
    id: "administration",
    label: "Administração",
    itemIds: ["profile", "users"]
  }
];

const navIconByTabId = {
  "invoicing-list": "🧾",
  "billing-list": "🛒",
  receivables: "💰",
  payables: "💸",
  ledger: "📒",
  "income-statement": "📈",
  "invoice-settlement-report": "⏱",
  "account-transfers-report": "🔄",
  "transfers-report": "↔",
  "financial-dashboard": "🏦",
  books: "📚",
  commodities: "💱",
  accounts: "🏦",
  customers: "👥",
  vendors: "🚚",
  users: "🛡",
  profile: "🔐"
};

function normalizeLabel(prefix, documentId, guid) {
  if (documentId) return `${prefix} ${documentId}`;
  return `${prefix} ${String(guid || "").slice(0, 8)}`;
}

function isInvoiceTab(tabId) {
  return tabId.startsWith("invoice:");
}

function isBillTab(tabId) {
  return tabId.startsWith("bill:");
}

function isIncomeStatementDetailTab(tabId) {
  return tabId === INCOME_STATEMENT_DETAIL_TAB_ID;
}

function isLedgerDetailTab(tabId) {
  return tabId === LEDGER_DETAIL_TAB_ID;
}

function isAccountTransfersDetailTab(tabId) {
  return tabId === ACCOUNT_TRANSFERS_DETAIL_TAB_ID;
}

function isTransfersDetailTab(tabId) {
  return tabId === TRANSFERS_DETAIL_TAB_ID;
}

function workspaceIdFromDetailTabId(tabId) {
  const entries = Object.entries(WORKSPACE_DETAIL_TAB_BY_ID);
  const found = entries.find(([, detailTabId]) => detailTabId === tabId);
  return found ? found[0] : "";
}

function detailTabIdFromWorkspaceId(workspaceId) {
  return WORKSPACE_DETAIL_TAB_BY_ID[workspaceId] || "";
}

function isWorkspaceDetailTab(tabId) {
  return Boolean(workspaceIdFromDetailTabId(tabId));
}

function invoiceGuidFromTab(tabId) {
  return tabId.slice("invoice:".length);
}

function billGuidFromTab(tabId) {
  return tabId.slice("bill:".length);
}

function sanitizeInvoiceTabs(items) {
  if (!Array.isArray(items)) return [];
  const seenGuids = new Set();
  const sanitized = [];
  for (const item of items) {
    const invoiceGuid = String(item?.invoiceGuid || "").trim();
    if (!invoiceGuid || seenGuids.has(invoiceGuid)) continue;
    seenGuids.add(invoiceGuid);
    const label =
      typeof item?.label === "string" && item.label.trim().length > 0
        ? item.label.trim()
        : normalizeLabel("Fatura", "", invoiceGuid);
    sanitized.push({
      id: `invoice:${invoiceGuid}`,
      label,
      invoiceGuid,
      openCreate: Boolean(item?.openCreate),
      initialPostingAccountGuid:
        typeof item?.initialPostingAccountGuid === "string"
          ? item.initialPostingAccountGuid.trim()
          : ""
    });
  }
  return sanitized;
}

function sanitizeBillTabs(items) {
  if (!Array.isArray(items)) return [];
  const seenGuids = new Set();
  const sanitized = [];
  for (const item of items) {
    const billGuid = String(item?.billGuid || "").trim();
    if (!billGuid || seenGuids.has(billGuid)) continue;
    seenGuids.add(billGuid);
    const label =
      typeof item?.label === "string" && item.label.trim().length > 0
        ? item.label.trim()
        : normalizeLabel("Compra", "", billGuid);
    sanitized.push({
      id: `bill:${billGuid}`,
      label,
      billGuid,
      openCreate: Boolean(item?.openCreate),
      initialPostingAccountGuid:
        typeof item?.initialPostingAccountGuid === "string"
          ? item.initialPostingAccountGuid.trim()
          : ""
    });
  }
  return sanitized;
}

function sanitizeReportTabs(items) {
  if (!Array.isArray(items)) return [];
  const sanitized = [];
  const seenReportIds = new Set();

  for (const item of items) {
    const explicitReportId = String(item?.reportId || "").trim();
    const rawId = String(item?.id || "").trim();
    const reportId =
      explicitReportId ||
      (rawId.startsWith("report:") ? rawId.slice("report:".length) : "");
    if (reportId !== "income-statement" && reportId !== "ledger" && reportId !== "account-transfers" && reportId !== "transfers") continue;
    if (seenReportIds.has(reportId)) continue;
    seenReportIds.add(reportId);

    const tabId =
      reportId === "ledger"
        ? LEDGER_DETAIL_TAB_ID
        : reportId === "account-transfers"
        ? ACCOUNT_TRANSFERS_DETAIL_TAB_ID
        : reportId === "transfers"
        ? TRANSFERS_DETAIL_TAB_ID
        : INCOME_STATEMENT_DETAIL_TAB_ID;
    const fallbackLabel =
      reportId === "ledger" ? "Razão"
      : reportId === "account-transfers" ? "Pagamentos por Conta"
      : reportId === "transfers" ? "Transferências"
      : "DRE Mensal";

    const label =
      typeof item?.label === "string" && item.label.trim().length > 0
        ? item.label.trim()
        : fallbackLabel;
    sanitized.push({
      id: tabId,
      label,
      reportId
    });
  }

  return sanitized;
}

function sanitizeWorkspaceTabs(items) {
  if (!Array.isArray(items)) return [];
  const seenWorkspaceIds = new Set();
  const sanitized = [];

  for (const item of items) {
    const explicitWorkspaceId = String(item?.workspaceId || "").trim();
    const rawId = String(item?.id || "").trim();
    const workspaceId =
      explicitWorkspaceId ||
      (rawId.startsWith("workspace:") ? rawId.slice("workspace:".length) : "");
    const detailTabId = detailTabIdFromWorkspaceId(workspaceId);
    if (!detailTabId) continue;
    if (seenWorkspaceIds.has(workspaceId)) continue;
    seenWorkspaceIds.add(workspaceId);

    const fallbackLabel =
      workspaceId === "accounts"
        ? "Saldos"
        : workspaceId === "receivables"
        ? "Contas a Receber"
        : workspaceId === "payables"
          ? "Contas a Pagar"
          : workspaceId === "invoicing-list"
            ? "Faturamentos"
            : workspaceId === "customers"
              ? "Clientes"
              : workspaceId === "vendors"
                ? "Fornecedores"
                : "Compras";

    const label =
      typeof item?.label === "string" && item.label.trim().length > 0
        ? item.label.trim()
        : fallbackLabel;

    sanitized.push({
      id: detailTabId,
      label,
      workspaceId
    });
  }

  return sanitized;
}

function loadAppTabsState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(APP_TABS_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      activeTab: typeof parsed.activeTab === "string" ? parsed.activeTab : DEFAULT_AUTH_TAB_ID,
      lastNonLedgerTab: typeof parsed.lastNonLedgerTab === "string" ? parsed.lastNonLedgerTab : DEFAULT_AUTH_TAB_ID,
      ledgerTargetAccountId:
        typeof parsed.ledgerTargetAccountId === "string" ? parsed.ledgerTargetAccountId : "",
      openInvoiceTabs: sanitizeInvoiceTabs(parsed.openInvoiceTabs),
      openBillTabs: sanitizeBillTabs(parsed.openBillTabs),
      openReportTabs: sanitizeReportTabs(parsed.openReportTabs),
      openWorkspaceTabs: sanitizeWorkspaceTabs(parsed.openWorkspaceTabs),
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed)
    };
  } catch {
    return null;
  }
}

export default function App() {
  const persistedTabsState = useMemo(() => loadAppTabsState(), []);
  const initialAuthSession = useMemo(() => getAuthSession(), []);
  const [activeTab, setActiveTab] = useState(() =>
    initialAuthSession ? persistedTabsState?.activeTab || DEFAULT_AUTH_TAB_ID : "login"
  );
  const [lastNonLedgerTab, setLastNonLedgerTab] = useState(
    () => persistedTabsState?.lastNonLedgerTab || DEFAULT_AUTH_TAB_ID
  );
  const [ledgerTargetAccountId, setLedgerTargetAccountId] = useState(
    () => persistedTabsState?.ledgerTargetAccountId || ""
  );
  const [openInvoiceTabs, setOpenInvoiceTabs] = useState(
    () => persistedTabsState?.openInvoiceTabs || []
  );
  const [openBillTabs, setOpenBillTabs] = useState(() => persistedTabsState?.openBillTabs || []);
  const [openReportTabs, setOpenReportTabs] = useState(
    () => persistedTabsState?.openReportTabs || []
  );
  const [openWorkspaceTabs, setOpenWorkspaceTabs] = useState(
    () => persistedTabsState?.openWorkspaceTabs || []
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => Boolean(persistedTabsState?.sidebarCollapsed)
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [hasAuthSession, setHasAuthSession] = useState(() => Boolean(initialAuthSession));
  const canManageUsers = currentUser == null || Boolean(currentUser.is_superuser) || Boolean(currentUser.is_admin);

  const detailTabs = useMemo(
    () => [
      ...openWorkspaceTabs.map((tab) => ({
        ...tab,
        component:
          tab.workspaceId === "accounts"
            ? AccountsPage
            : tab.workspaceId === "receivables"
            ? ReceivablesPage
            : tab.workspaceId === "payables"
              ? PayablesPage
              : tab.workspaceId === "invoicing-list"
                ? InvoicingListPage
                : tab.workspaceId === "customers"
                  ? CustomersPage
                  : tab.workspaceId === "vendors"
                    ? VendorsPage
                    : BillingListPage,
        closable: true
      })),
      ...openReportTabs.map((tab) => ({
        ...tab,
        component:
          tab.reportId === "ledger"
            ? LedgerPage
            : tab.reportId === "account-transfers"
            ? AccountTransfersReportPage
            : tab.reportId === "transfers"
            ? TransfersBetweenAccountsPage
            : IncomeStatementPage,
        closable: true
      })),
      ...openInvoiceTabs.map((tab) => ({ ...tab, component: InvoicingPage, closable: true })),
      ...openBillTabs.map((tab) => ({ ...tab, component: BillingPage, closable: true }))
    ],
    [openBillTabs, openInvoiceTabs, openReportTabs, openWorkspaceTabs]
  );
  const navigationTabs = useMemo(() => {
    if (!hasAuthSession) return baseTabs.filter((tab) => tab.id === "login");
    return baseTabs.filter((tab) => {
      if (tab.id === "login") return false;
      if (tab.id === "users" && !canManageUsers) return false;
      if (tab.id === "financial-dashboard" && !canManageUsers) return false;
      return true;
    });
  }, [canManageUsers, hasAuthSession]);
  const navigationTabsById = useMemo(
    () => new Map(navigationTabs.map((tab) => [tab.id, tab])),
    [navigationTabs]
  );
  const primaryNavSections = useMemo(() => {
    if (!hasAuthSession) return [];
    return primaryNavSectionsConfig
      .map((section) => ({
        ...section,
        items: section.itemIds.map((id) => navigationTabsById.get(id)).filter(Boolean)
      }))
      .filter((section) => section.items.length > 0);
  }, [hasAuthSession, navigationTabsById]);
  const tabs = useMemo(
    () => (hasAuthSession ? [...navigationTabs, ...detailTabs] : navigationTabs),
    [detailTabs, hasAuthSession, navigationTabs]
  );
  const activeTabDef = tabs.find((tab) => tab.id === activeTab) || tabs[0] || baseTabs[0];
  const ActiveComponent = activeTabDef.component;
  const tabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);
  const isInvoicingTab =
    activeTab === "receivables" ||
    activeTab === "payables" ||
    activeTab === "invoicing-list" ||
    activeTab === "billing-list" ||
    isWorkspaceDetailTab(activeTab) ||
    activeTab === "ledger" ||
    isLedgerDetailTab(activeTab) ||
    isInvoiceTab(activeTab) ||
    isBillTab(activeTab);

  useEffect(() => {
    let cancelled = false;

    const syncCurrentUser = async () => {
      const session = getAuthSession();
      if (!session) {
        if (!cancelled) {
          setHasAuthSession(false);
          setCurrentUser(null);
        }
        return;
      }

      if (!cancelled) setHasAuthSession(true);
      const meRes = await api.get("/auth/me");
      if (cancelled) return;
      if (!meRes.ok) {
        clearAuthSession();
        setHasAuthSession(false);
        setCurrentUser(null);
        return;
      }
      setCurrentUser(meRes.data);
    };

    syncCurrentUser();
    if (typeof window !== "undefined") {
      window.addEventListener(authSessionChangedEvent, syncCurrentUser);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener(authSessionChangedEvent, syncCurrentUser);
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "ledger" && !isLedgerDetailTab(activeTab)) {
      setLastNonLedgerTab(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (tabIds.has(activeTab)) return;
    setActiveTab(hasAuthSession ? DEFAULT_AUTH_TAB_ID : "login");
  }, [activeTab, hasAuthSession, tabIds]);

  useEffect(() => {
    if (hasAuthSession) return;
    setOpenInvoiceTabs([]);
    setOpenBillTabs([]);
    setOpenReportTabs([]);
    setOpenWorkspaceTabs([]);
    setLedgerTargetAccountId("");
    if (activeTab !== "login") {
      setActiveTab("login");
    }
  }, [activeTab, hasAuthSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      APP_TABS_STATE_KEY,
      JSON.stringify({
        activeTab,
        lastNonLedgerTab,
        ledgerTargetAccountId,
        openInvoiceTabs,
        openBillTabs,
        openReportTabs,
        openWorkspaceTabs,
        sidebarCollapsed
      })
    );
  }, [
    activeTab,
    lastNonLedgerTab,
    ledgerTargetAccountId,
    openInvoiceTabs,
    openBillTabs,
    openReportTabs,
    openWorkspaceTabs,
    sidebarCollapsed
  ]);

  const handleOpenReportTab = useCallback(({ reportId, label }) => {
    if (!reportId) return;
    const tabId =
      reportId === "ledger"
        ? LEDGER_DETAIL_TAB_ID
        : reportId === "account-transfers"
        ? ACCOUNT_TRANSFERS_DETAIL_TAB_ID
        : reportId === "transfers"
        ? TRANSFERS_DETAIL_TAB_ID
        : INCOME_STATEMENT_DETAIL_TAB_ID;
    const fallbackLabel =
      reportId === "ledger" ? "Razão"
      : reportId === "account-transfers" ? "Pagamentos por Conta"
      : reportId === "transfers" ? "Transferências"
      : "DRE Mensal";
    const normalizedLabel = String(label || "").trim() || fallbackLabel;
    setOpenReportTabs((current) => {
      const existing = current.find((tab) => tab.id === tabId);
      if (existing) {
        if (existing.label === normalizedLabel) {
          return current;
        }
        return current.map((tab) => (tab.id === tabId ? { ...tab, label: normalizedLabel } : tab));
      }
      return [
        ...current,
        {
          id: tabId,
          label: normalizedLabel,
          reportId
        }
      ];
    });
    setActiveTab((current) => (current === tabId ? current : tabId));
  }, []);

  const handleLedgerAccountChange = useCallback((accountId) => {
    const nextAccountId = String(accountId || "");
    setLedgerTargetAccountId((current) => (current === nextAccountId ? current : nextAccountId));
  }, []);

  const handleOpenLedger = useCallback(({ accountId } = {}) => {
    const nextAccountId = String(accountId || "");
    setLedgerTargetAccountId((current) => (current === nextAccountId ? current : nextAccountId));
    handleOpenReportTab({ reportId: "ledger", label: "Razão" });
  }, [handleOpenReportTab]);

  const handleOpenIncomeStatementTab = useCallback(() => {
    handleOpenReportTab({ reportId: "income-statement", label: "DRE Mensal" });
  }, [handleOpenReportTab]);

  const handleOpenAccountTransfersTab = useCallback(() => {
    handleOpenReportTab({ reportId: "account-transfers", label: "Pagamentos por Conta" });
  }, [handleOpenReportTab]);

  const handleOpenTransfersTab = useCallback(() => {
    handleOpenReportTab({ reportId: "transfers", label: "Transferências" });
  }, [handleOpenReportTab]);

  const handleOpenWorkspaceTab = useCallback(({ workspaceId, label }) => {
    if (!workspaceId) return;
    const tabId = detailTabIdFromWorkspaceId(workspaceId);
    if (!tabId) return;
    const normalizedLabel = String(label || "").trim();
    const fallbackLabel =
      workspaceId === "accounts"
        ? "Saldos"
        : workspaceId === "receivables"
        ? "Contas a Receber"
        : workspaceId === "payables"
          ? "Contas a Pagar"
          : workspaceId === "invoicing-list"
            ? "Faturamentos"
            : workspaceId === "customers"
              ? "Clientes"
              : workspaceId === "vendors"
                ? "Fornecedores"
                : "Compras";
    setOpenWorkspaceTabs((current) => {
      const existing = current.find((tab) => tab.id === tabId);
      if (existing) {
        if (!normalizedLabel || existing.label === normalizedLabel) {
          return current;
        }
        return current.map((tab) =>
          tab.id === tabId ? { ...tab, label: normalizedLabel } : tab
        );
      }
      return [
        ...current,
        {
          id: tabId,
          label: normalizedLabel || fallbackLabel,
          workspaceId
        }
      ];
    });
    setActiveTab((current) => (current === tabId ? current : tabId));
  }, []);

  const handleOpenInvoicing = ({
    invoiceGuid,
    invoiceId,
    tabLabel = "",
    initialPostingAccountGuid = ""
  } = {}) => {
    if (!invoiceGuid) return;
    const tabId = `invoice:${invoiceGuid}`;
    const label = String(tabLabel || "").trim() || normalizeLabel("Fatura", invoiceId, invoiceGuid);

    setOpenInvoiceTabs((current) => {
      let found = false;
      const updated = current.map((tab) => {
        if (tab.id !== tabId) return tab;
        found = true;
        const nextPostingGuid =
          String(initialPostingAccountGuid || "").trim() || tab.initialPostingAccountGuid || "";
        if (tab.label === label && !tab.openCreate && tab.initialPostingAccountGuid === nextPostingGuid) {
          return tab;
        }
        return { ...tab, label, openCreate: false, initialPostingAccountGuid: nextPostingGuid };
      });
      if (found) return updated;
      return [
        ...updated,
        {
          id: tabId,
          label,
          invoiceGuid,
          openCreate: false,
          initialPostingAccountGuid: String(initialPostingAccountGuid || "").trim()
        }
      ];
    });
    setActiveTab(tabId);
  };

  const handleCreateInvoicing = () => {
    const tabId = `invoice:${NEW_INVOICE_TAB_GUID}`;
    const label = "Nova Fatura";

    setOpenInvoiceTabs((current) => {
      let found = false;
      const updated = current.map((tab) => {
        if (tab.id !== tabId) return tab;
        found = true;
        if (tab.label === label && tab.openCreate) return tab;
        return { ...tab, label, openCreate: true };
      });
      if (found) return updated;
      return [
        ...updated,
        {
          id: tabId,
          label,
          invoiceGuid: NEW_INVOICE_TAB_GUID,
          openCreate: true,
          initialPostingAccountGuid: ""
        }
      ];
    });
    setActiveTab(tabId);
  };

  const handleOpenBilling = ({
    billGuid,
    billId,
    tabLabel = "",
    initialPostingAccountGuid = ""
  } = {}) => {
    if (!billGuid) return;
    const tabId = `bill:${billGuid}`;
    const label = String(tabLabel || "").trim() || normalizeLabel("Compra", billId, billGuid);

    setOpenBillTabs((current) => {
      let found = false;
      const updated = current.map((tab) => {
        if (tab.id !== tabId) return tab;
        found = true;
        const nextPostingGuid =
          String(initialPostingAccountGuid || "").trim() || tab.initialPostingAccountGuid || "";
        if (tab.label === label && !tab.openCreate && tab.initialPostingAccountGuid === nextPostingGuid) {
          return tab;
        }
        return { ...tab, label, openCreate: false, initialPostingAccountGuid: nextPostingGuid };
      });
      if (found) return updated;
      return [
        ...updated,
        {
          id: tabId,
          label,
          billGuid,
          openCreate: false,
          initialPostingAccountGuid: String(initialPostingAccountGuid || "").trim()
        }
      ];
    });
    setActiveTab(tabId);
  };

  const handleCreateBilling = () => {
    const tabId = `bill:${NEW_BILL_TAB_GUID}`;
    const label = "Nova Compra";

    setOpenBillTabs((current) => {
      let found = false;
      const updated = current.map((tab) => {
        if (tab.id !== tabId) return tab;
        found = true;
        if (tab.label === label && tab.openCreate) return tab;
        return { ...tab, label, openCreate: true };
      });
      if (found) return updated;
      return [
        ...updated,
        {
          id: tabId,
          label,
          billGuid: NEW_BILL_TAB_GUID,
          openCreate: true,
          initialPostingAccountGuid: ""
        }
      ];
    });
    setActiveTab(tabId);
  };

  const closeDynamicTab = (tabId, preferredFallbackTabId = "") => {
    const currentIds = tabs.map((tab) => tab.id);
    const currentIndex = currentIds.indexOf(tabId);
    const detailTabIdSet = new Set(detailTabs.map((t) => t.id));
    const prevTabId = currentIndex > 0 ? currentIds[currentIndex - 1] : null;
    const defaultFallbackTab =
      prevTabId && detailTabIdSet.has(prevTabId) && prevTabId !== tabId
        ? prevTabId
        : DEFAULT_AUTH_TAB_ID;
    const fallbackTab =
      preferredFallbackTabId && tabIds.has(preferredFallbackTabId)
        ? preferredFallbackTabId
        : defaultFallbackTab;

    if (isInvoiceTab(tabId)) {
      setOpenInvoiceTabs((current) => current.filter((tab) => tab.id !== tabId));
    }
    if (isBillTab(tabId)) {
      setOpenBillTabs((current) => current.filter((tab) => tab.id !== tabId));
    }
    if (isIncomeStatementDetailTab(tabId) || isLedgerDetailTab(tabId) || isAccountTransfersDetailTab(tabId) || isTransfersDetailTab(tabId)) {
      setOpenReportTabs((current) => current.filter((tab) => tab.id !== tabId));
    }
    if (isWorkspaceDetailTab(tabId)) {
      setOpenWorkspaceTabs((current) => current.filter((tab) => tab.id !== tabId));
    }

    setActiveTab((current) => (current === tabId ? fallbackTab : current));
  };

  const handleLoginSuccess = async (user) => {
    if (user) {
      setHasAuthSession(true);
      setCurrentUser(user);
      setActiveTab(DEFAULT_AUTH_TAB_ID);
      return;
    }
    const meRes = await api.get("/auth/me");
    if (meRes.ok) {
      setHasAuthSession(true);
      setCurrentUser(meRes.data);
      setActiveTab(DEFAULT_AUTH_TAB_ID);
      return;
    }
    setHasAuthSession(false);
    setCurrentUser(null);
  };

  const handleLogout = () => {
    clearAuthSession();
    setHasAuthSession(false);
    setCurrentUser(null);
    setActiveTab("login");
  };

  const ledgerReturnTab =
    (lastNonLedgerTab === "income-statement" ||
      isIncomeStatementDetailTab(lastNonLedgerTab) ||
      lastNonLedgerTab === "ledger" ||
      isWorkspaceDetailTab(lastNonLedgerTab) ||
      lastNonLedgerTab === "receivables" ||
      lastNonLedgerTab === "payables" ||
      lastNonLedgerTab === "invoicing-list" ||
      lastNonLedgerTab === "billing-list" ||
      isInvoiceTab(lastNonLedgerTab) ||
      isBillTab(lastNonLedgerTab)) &&
    tabIds.has(lastNonLedgerTab)
      ? lastNonLedgerTab
      : "";

  const buildLedgerProps = () => ({
    initialAccountId: ledgerTargetAccountId,
    returnTab: ledgerReturnTab,
    onReturnToTab: (tabId) => setActiveTab(tabId),
    onLedgerAccountChange: handleLedgerAccountChange,
    onOpenInvoicing: handleOpenInvoicing,
    onOpenBilling: handleOpenBilling
  });

  const buildWorkspaceTabProps = (workspaceId) => {
    if (workspaceId === "accounts") {
      return {
        onOpenLedger: handleOpenLedger
      };
    }
    if (workspaceId === "receivables") {
      return {
        onOpenInvoicing: handleOpenInvoicing,
        onCreateInvoicing: handleCreateInvoicing,
        onOpenBilling: ({ billGuid, billId }) =>
          handleOpenInvoicing({ invoiceGuid: billGuid, invoiceId: billId })
      };
    }
    if (workspaceId === "payables") {
      return {
        onOpenBilling: handleOpenBilling,
        onCreateBilling: handleCreateBilling,
        onOpenInvoicing: ({ invoiceGuid, invoiceId }) =>
          handleOpenBilling({ billGuid: invoiceGuid, billId: invoiceId })
      };
    }
    if (workspaceId === "invoicing-list") {
      return {
        onOpenInvoicing: handleOpenInvoicing,
        onCreateInvoicing: handleCreateInvoicing,
        onOpenBilling: ({ billGuid, billId }) =>
          handleOpenInvoicing({ invoiceGuid: billGuid, invoiceId: billId })
      };
    }
    if (workspaceId === "billing-list") {
      return {
        onOpenBilling: handleOpenBilling,
        onCreateBilling: handleCreateBilling,
        onOpenInvoicing: ({ invoiceGuid, invoiceId }) =>
          handleOpenBilling({ billGuid: invoiceGuid, billId: invoiceId })
      };
    }
    return {};
  };

  const buildInvoiceTabProps = (tabId) => {
    const currentTab = openInvoiceTabs.find((tab) => tab.id === tabId) || null;
    const openCreateOnMount = Boolean(currentTab?.openCreate);
    const invoicingListFallback =
      detailTabIdFromWorkspaceId("invoicing-list") && tabIds.has(detailTabIdFromWorkspaceId("invoicing-list"))
        ? detailTabIdFromWorkspaceId("invoicing-list")
        : "invoicing-list";
    return {
      initialInvoiceGuid:
        currentTab?.invoiceGuid === NEW_INVOICE_TAB_GUID ? "" : invoiceGuidFromTab(tabId),
      onOpenInvoicingList: () => closeDynamicTab(tabId, invoicingListFallback),
      onOpenInvoiceTab: handleOpenInvoicing,
      onInvoiceDeleted: () => closeDynamicTab(tabId, invoicingListFallback),
      initialPostingAccountGuid: currentTab?.initialPostingAccountGuid || "",
      openCreateOnMount,
      onCreateMountHandled: openCreateOnMount
        ? () =>
            setOpenInvoiceTabs((current) =>
              current.map((tab) =>
                tab.id === tabId && tab.openCreate ? { ...tab, openCreate: false } : tab
              )
            )
        : null
    };
  };

  const buildBillTabProps = (tabId) => {
    const currentTab = openBillTabs.find((tab) => tab.id === tabId) || null;
    const openCreateOnMount = Boolean(currentTab?.openCreate);
    const billingListFallback =
      detailTabIdFromWorkspaceId("billing-list") && tabIds.has(detailTabIdFromWorkspaceId("billing-list"))
        ? detailTabIdFromWorkspaceId("billing-list")
        : "billing-list";
    return {
      initialBillGuid: currentTab?.billGuid === NEW_BILL_TAB_GUID ? "" : billGuidFromTab(tabId),
      onOpenBillingList: () => closeDynamicTab(tabId, billingListFallback),
      onOpenBillTab: handleOpenBilling,
      onBillDeleted: () => closeDynamicTab(tabId, billingListFallback),
      initialPostingAccountGuid: currentTab?.initialPostingAccountGuid || "",
      openCreateOnMount,
      onCreateMountHandled: openCreateOnMount
        ? () =>
            setOpenBillTabs((current) =>
              current.map((tab) =>
                tab.id === tabId && tab.openCreate ? { ...tab, openCreate: false } : tab
              )
            )
        : null,
      onBillCreated: currentTab?.billGuid === NEW_BILL_TAB_GUID
        ? ({ billGuid, billId }) => {
            const newTabId = `bill:${billGuid}`;
            const label = normalizeLabel("Compra", billId, billGuid);
            setOpenBillTabs((current) =>
              current.map((tab) =>
                tab.id === tabId
                  ? { id: newTabId, label, billGuid, openCreate: false, initialPostingAccountGuid: "" }
                  : tab
              )
            );
            setActiveTab(newTabId);
          }
        : null
    };
  };

  const isActiveDetailTab = detailTabs.some((tab) => tab.id === activeTab);
  const detailTabPropsById = detailTabs.reduce((acc, tab) => {
    if (isWorkspaceDetailTab(tab.id)) {
      acc[tab.id] = buildWorkspaceTabProps(tab.workspaceId);
      return acc;
    }
    if (isInvoiceTab(tab.id)) {
      acc[tab.id] = buildInvoiceTabProps(tab.id);
      return acc;
    }
    if (isBillTab(tab.id)) {
      acc[tab.id] = buildBillTabProps(tab.id);
      return acc;
    }
    if (isLedgerDetailTab(tab.id)) {
      acc[tab.id] = buildLedgerProps();
      return acc;
    }
    if (isIncomeStatementDetailTab(tab.id)) {
      acc[tab.id] = { onOpenLedger: handleOpenLedger };
      return acc;
    }
    if (isAccountTransfersDetailTab(tab.id)) {
      acc[tab.id] = { onOpenInvoicing: handleOpenInvoicing, onOpenBilling: handleOpenBilling, onOpenLedger: handleOpenLedger };
      return acc;
    }
    if (isTransfersDetailTab(tab.id)) {
      acc[tab.id] = { onOpenInvoicing: handleOpenInvoicing, onOpenBilling: handleOpenBilling, onOpenLedger: handleOpenLedger };
      return acc;
    }
    acc[tab.id] = {};
    return acc;
  }, {});

  const activeProps =
    activeTab === "login"
      ? { currentUser, onLoginSuccess: handleLoginSuccess }
      : activeTab === "accounts"
      ? { onOpenLedger: handleOpenLedger }
      : activeTab === "income-statement" || isIncomeStatementDetailTab(activeTab)
        ? { onOpenLedger: handleOpenLedger }
      : activeTab === "invoice-settlement-report"
        ? { onOpenInvoicing: handleOpenInvoicing }
      : activeTab === "account-transfers-report" || isAccountTransfersDetailTab(activeTab)
        ? { onOpenInvoicing: handleOpenInvoicing, onOpenBilling: handleOpenBilling, onOpenLedger: handleOpenLedger }
      : activeTab === "transfers-report" || isTransfersDetailTab(activeTab)
        ? { onOpenInvoicing: handleOpenInvoicing, onOpenBilling: handleOpenBilling, onOpenLedger: handleOpenLedger }
      : activeTab === "receivables"
        ? buildWorkspaceTabProps("receivables")
      : activeTab === "payables"
        ? buildWorkspaceTabProps("payables")
      : activeTab === "ledger" || isLedgerDetailTab(activeTab)
        ? buildLedgerProps()
      : activeTab === "invoicing-list"
        ? buildWorkspaceTabProps("invoicing-list")
      : activeTab === "billing-list"
        ? buildWorkspaceTabProps("billing-list")
      : activeTab === "users"
        ? { currentUser }
      : activeTab === "profile"
        ? { currentUser }
      : isInvoiceTab(activeTab)
        ? buildInvoiceTabProps(activeTab)
      : isBillTab(activeTab)
        ? buildBillTabProps(activeTab)
        : {};

  return (
    <div className="app-shell">
      <header className="brand-bar">
        <div className="container d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-3">
            <button
              type="button"
              className="brand-logo-btn"
              onClick={() => setActiveTab(hasAuthSession ? DEFAULT_AUTH_TAB_ID : "login")}
              aria-label="Ir para início"
            >
              <img src="/LOGO - Vertical-Preto.png" alt="IgeosCash" className="brand-logo" />
            </button>
            <div>
              <h1 className="brand-title">IgeosCash</h1>
              <div className="small-muted">API: {apiBase()} · {APP_VERSION} · {APP_RELEASE_DATE}</div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            {hasAuthSession && currentUser ? (
              <span className="small-muted brand-user-label">
                Usuário: {currentUser.full_name || currentUser.email}
              </span>
            ) : hasAuthSession ? (
              <span className="small-muted brand-user-label">Sessão autenticada</span>
            ) : null}
            {hasAuthSession ? (
              <button className="btn btn-sm btn-outline-light" type="button" onClick={handleLogout}>
                Sair
              </button>
            ) : (
              <button
                className="btn btn-sm btn-outline-light"
                type="button"
                onClick={() => setActiveTab("login")}
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      <main
        className={`container-fluid app-main-container py-4 ${isInvoicingTab ? "is-invoicing" : ""} ${
          hasAuthSession ? "is-authenticated" : ""
        }`}
      >
        {hasAuthSession ? (
          <div className={`app-layout ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
            <aside className={`section-card app-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
              <button
                type="button"
                className="app-sidebar-toggle"
                aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
                title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
                onClick={() => setSidebarCollapsed((current) => !current)}
              >
                {sidebarCollapsed ? ">>" : "<<"}
              </button>

              <div className="app-sidebar-sections">
                {primaryNavSections.map((section) => (
                  <section key={section.id} className="app-nav-section">
                    <h2 className="app-nav-section-title">{section.label}</h2>
                    <div className="app-nav-links">
                      {section.items.map((tab) => {
                        const isIncomeStatementNav = tab.id === "income-statement";
                        const isLedgerNav = tab.id === "ledger";
                        const isAccountTransfersNav = tab.id === "account-transfers-report";
                        const isTransfersNav = tab.id === "transfers-report";
                        const workspaceDetailTabId = detailTabIdFromWorkspaceId(tab.id);
                        const isWorkspaceNav = Boolean(workspaceDetailTabId);
                        const isActive =
                          activeTab === tab.id ||
                          (isIncomeStatementNav && isIncomeStatementDetailTab(activeTab)) ||
                          (isLedgerNav && isLedgerDetailTab(activeTab)) ||
                          (isAccountTransfersNav && isAccountTransfersDetailTab(activeTab)) ||
                          (isTransfersNav && isTransfersDetailTab(activeTab)) ||
                          (isWorkspaceNav && activeTab === workspaceDetailTabId);
                        return (
                        <button
                          key={tab.id}
                          className={`app-nav-link ${isActive ? "is-active" : ""}`}
                          type="button"
                          title={tab.label}
                          aria-label={tab.label}
                          onClick={() => {
                            if (isIncomeStatementNav) {
                              handleOpenIncomeStatementTab();
                              return;
                            }
                            if (isLedgerNav) {
                              handleOpenLedger({});
                              return;
                            }
                            if (isAccountTransfersNav) {
                              handleOpenAccountTransfersTab();
                              return;
                            }
                            if (isTransfersNav) {
                              handleOpenTransfersTab();
                              return;
                            }
                            if (isWorkspaceNav) {
                              handleOpenWorkspaceTab({
                                workspaceId: tab.id,
                                label: tab.label
                              });
                              return;
                            }
                            setActiveTab(tab.id);
                          }}
                        >
                          <span className="app-nav-link-icon" aria-hidden="true">
                            {navIconByTabId[tab.id] || "•"}
                          </span>
                          <span className="app-nav-link-label">{tab.label}</span>
                        </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </aside>

            <section className="app-content">
              {detailTabs.length > 0 ? (
                <ul className="nav nav-pills app-detail-tabs mb-3 flex-wrap gap-1">
                  {detailTabs.map((tab) => (
                    <li key={tab.id} className="nav-item app-tab-item is-closable">
                      <button
                        className={`nav-link ${activeTab === tab.id ? "active" : ""}`}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                      <button
                        type="button"
                        className="app-tab-close"
                        aria-label={`Fechar ${tab.label}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          closeDynamicTab(tab.id);
                        }}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="section-card">
                {detailTabs.map((tab) => {
                  const DetailComponent = tab.component;
                  return (
                    <div
                      key={tab.id}
                      style={{ display: activeTab === tab.id ? "block" : "none" }}
                      aria-hidden={activeTab === tab.id ? "false" : "true"}
                    >
                      <DetailComponent {...(detailTabPropsById[tab.id] || {})} />
                    </div>
                  );
                })}
                {!isActiveDetailTab ? (
                  <ActiveComponent key={activeTab} {...activeProps} />
                ) : null}
              </div>
            </section>
          </div>
        ) : (
          <div className="section-card">
            <ActiveComponent key={activeTab} {...activeProps} />
          </div>
        )}
      </main>
    </div>
  );
}
