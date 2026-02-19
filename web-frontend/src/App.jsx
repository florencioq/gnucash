import React, { useEffect, useMemo, useState } from "react";
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
import ReceivablesPage from "./pages/ReceivablesPage.jsx";
import PayablesPage from "./pages/PayablesPage.jsx";
import {
  api,
  apiBase,
  authSessionChangedEvent,
  clearAuthSession,
  getAuthSession
} from "./api/client.js";

const APP_TABS_STATE_KEY = "gnucash.app-tabs-state.v1";
const NEW_INVOICE_TAB_GUID = "new";
const NEW_BILL_TAB_GUID = "new";
const DEFAULT_AUTH_TAB_ID = "income-statement";

const baseTabs = [
  { id: "login", label: "Login", component: LoginPage },
  { id: "books", label: "Livros", component: BooksPage },
  { id: "commodities", label: "Moedas", component: CommoditiesPage },
  { id: "accounts", label: "Contas", component: AccountsPage },
  { id: "customers", label: "Clientes", component: CustomersPage },
  { id: "vendors", label: "Fornecedores", component: VendorsPage },
  { id: "users", label: "Usuários", component: UsersPage },
  { id: "ledger", label: "Razão", component: LedgerPage },
  { id: "income-statement", label: "DRE Mensal", component: IncomeStatementPage },
  {
    id: "invoice-settlement-report",
    label: "Prazo Quitação",
    component: InvoiceSettlementReportPage
  },
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
    itemIds: ["income-statement", "invoice-settlement-report"]
  },
  {
    id: "masters",
    label: "Cadastros",
    itemIds: ["books", "commodities", "accounts", "customers", "vendors"]
  },
  {
    id: "administration",
    label: "Administração",
    itemIds: ["users"]
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
  books: "📚",
  commodities: "💱",
  accounts: "🏦",
  customers: "👥",
  vendors: "🚚",
  users: "🛡"
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => Boolean(persistedTabsState?.sidebarCollapsed)
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [hasAuthSession, setHasAuthSession] = useState(() => Boolean(initialAuthSession));
  const canManageUsers = currentUser == null || Boolean(currentUser.is_superuser);

  const detailTabs = useMemo(
    () => [
      ...openInvoiceTabs.map((tab) => ({ ...tab, component: InvoicingPage, closable: true })),
      ...openBillTabs.map((tab) => ({ ...tab, component: BillingPage, closable: true }))
    ],
    [openBillTabs, openInvoiceTabs]
  );
  const navigationTabs = useMemo(() => {
    if (!hasAuthSession) return baseTabs.filter((tab) => tab.id === "login");
    return baseTabs.filter((tab) => {
      if (tab.id === "login") return false;
      if (tab.id === "users" && !canManageUsers) return false;
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
    if (activeTab !== "ledger") {
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
        sidebarCollapsed
      })
    );
  }, [activeTab, lastNonLedgerTab, ledgerTargetAccountId, openInvoiceTabs, openBillTabs, sidebarCollapsed]);

  const handleOpenLedger = ({ accountId }) => {
    setLedgerTargetAccountId(accountId || "");
    setActiveTab("ledger");
  };

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
    const defaultFallbackTab = currentIndex > 0 ? currentIds[currentIndex - 1] : "books";
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
    (lastNonLedgerTab === "payables" ||
      lastNonLedgerTab === "invoicing-list" ||
      lastNonLedgerTab === "billing-list" ||
      isInvoiceTab(lastNonLedgerTab) ||
      isBillTab(lastNonLedgerTab)) &&
    tabIds.has(lastNonLedgerTab)
      ? lastNonLedgerTab
      : "";

  const activeProps =
    activeTab === "login"
      ? { currentUser, onLoginSuccess: handleLoginSuccess }
      : activeTab === "accounts"
      ? { onOpenLedger: handleOpenLedger }
      : activeTab === "income-statement"
        ? { onOpenLedger: handleOpenLedger }
      : activeTab === "invoice-settlement-report"
        ? { onOpenInvoicing: handleOpenInvoicing }
      : activeTab === "receivables"
        ? {
            onOpenInvoicing: handleOpenInvoicing,
            onCreateInvoicing: handleCreateInvoicing,
            onOpenBilling: ({ billGuid, billId }) =>
              handleOpenInvoicing({ invoiceGuid: billGuid, invoiceId: billId })
          }
      : activeTab === "payables"
        ? {
            onOpenBilling: handleOpenBilling,
            onCreateBilling: handleCreateBilling,
            onOpenInvoicing: ({ invoiceGuid, invoiceId }) =>
              handleOpenBilling({ billGuid: invoiceGuid, billId: invoiceId })
          }
      : activeTab === "ledger"
        ? {
            initialAccountId: ledgerTargetAccountId,
            returnTab: ledgerReturnTab,
            onReturnToTab: (tabId) => setActiveTab(tabId),
            onOpenInvoicing: handleOpenInvoicing,
            onOpenBilling: handleOpenBilling
          }
      : activeTab === "invoicing-list"
        ? {
            onOpenInvoicing: handleOpenInvoicing,
            onCreateInvoicing: handleCreateInvoicing,
            onOpenBilling: ({ billGuid, billId }) =>
              handleOpenInvoicing({ invoiceGuid: billGuid, invoiceId: billId })
          }
      : activeTab === "billing-list"
        ? {
            onOpenBilling: handleOpenBilling,
            onCreateBilling: handleCreateBilling,
            onOpenInvoicing: ({ invoiceGuid, invoiceId }) =>
              handleOpenBilling({ billGuid: invoiceGuid, billId: invoiceId })
          }
      : isInvoiceTab(activeTab)
        ? (() => {
            const currentTab = openInvoiceTabs.find((tab) => tab.id === activeTab) || null;
            const openCreateOnMount = Boolean(currentTab?.openCreate);
            return {
              initialInvoiceGuid:
                currentTab?.invoiceGuid === NEW_INVOICE_TAB_GUID ? "" : invoiceGuidFromTab(activeTab),
              onOpenInvoicingList: () => closeDynamicTab(activeTab, "invoicing-list"),
              onOpenInvoiceTab: handleOpenInvoicing,
              onInvoiceDeleted: () => closeDynamicTab(activeTab, "invoicing-list"),
              initialPostingAccountGuid: currentTab?.initialPostingAccountGuid || "",
              openCreateOnMount,
              onCreateMountHandled: openCreateOnMount
                ? () =>
                    setOpenInvoiceTabs((current) =>
                      current.map((tab) =>
                        tab.id === activeTab && tab.openCreate ? { ...tab, openCreate: false } : tab
                      )
                    )
                : null
            };
          })()
      : isBillTab(activeTab)
        ? (() => {
            const currentTab = openBillTabs.find((tab) => tab.id === activeTab) || null;
            const openCreateOnMount = Boolean(currentTab?.openCreate);
            return {
              initialBillGuid: currentTab?.billGuid === NEW_BILL_TAB_GUID ? "" : billGuidFromTab(activeTab),
              onOpenBillingList: () => closeDynamicTab(activeTab, "billing-list"),
              onOpenBillTab: handleOpenBilling,
              onBillDeleted: () => closeDynamicTab(activeTab, "billing-list"),
              initialPostingAccountGuid: currentTab?.initialPostingAccountGuid || "",
              openCreateOnMount,
              onCreateMountHandled: openCreateOnMount
                ? () =>
                    setOpenBillTabs((current) =>
                      current.map((tab) =>
                        tab.id === activeTab && tab.openCreate ? { ...tab, openCreate: false } : tab
                      )
                    )
                : null
            };
          })()
        : {};

  return (
    <div className="app-shell">
      <header className="brand-bar">
        <div className="container d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div>
            <h1 className="brand-title">IgeosCash</h1>
            <div className="small-muted">API: {apiBase()}</div>
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
                      {section.items.map((tab) => (
                        <button
                          key={tab.id}
                          className={`app-nav-link ${activeTab === tab.id ? "is-active" : ""}`}
                          type="button"
                          title={tab.label}
                          aria-label={tab.label}
                          onClick={() => setActiveTab(tab.id)}
                        >
                          <span className="app-nav-link-icon" aria-hidden="true">
                            {navIconByTabId[tab.id] || "•"}
                          </span>
                          <span className="app-nav-link-label">{tab.label}</span>
                        </button>
                      ))}
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
                <ActiveComponent key={activeTab} {...activeProps} />
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
