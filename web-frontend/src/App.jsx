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
  { id: "invoicing-list", label: "Faturamentos", component: InvoicingListPage },
  { id: "billing-list", label: "Compras", component: BillingListPage }
];

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
      activeTab: typeof parsed.activeTab === "string" ? parsed.activeTab : "books",
      lastNonLedgerTab: typeof parsed.lastNonLedgerTab === "string" ? parsed.lastNonLedgerTab : "books",
      ledgerTargetAccountId:
        typeof parsed.ledgerTargetAccountId === "string" ? parsed.ledgerTargetAccountId : "",
      openInvoiceTabs: sanitizeInvoiceTabs(parsed.openInvoiceTabs),
      openBillTabs: sanitizeBillTabs(parsed.openBillTabs)
    };
  } catch {
    return null;
  }
}

export default function App() {
  const persistedTabsState = useMemo(() => loadAppTabsState(), []);
  const initialAuthSession = useMemo(() => getAuthSession(), []);
  const [activeTab, setActiveTab] = useState(() =>
    initialAuthSession ? persistedTabsState?.activeTab || "books" : "login"
  );
  const [lastNonLedgerTab, setLastNonLedgerTab] = useState(
    () => persistedTabsState?.lastNonLedgerTab || "books"
  );
  const [ledgerTargetAccountId, setLedgerTargetAccountId] = useState(
    () => persistedTabsState?.ledgerTargetAccountId || ""
  );
  const [openInvoiceTabs, setOpenInvoiceTabs] = useState(
    () => persistedTabsState?.openInvoiceTabs || []
  );
  const [openBillTabs, setOpenBillTabs] = useState(() => persistedTabsState?.openBillTabs || []);
  const [currentUser, setCurrentUser] = useState(null);
  const [hasAuthSession, setHasAuthSession] = useState(() => Boolean(initialAuthSession));

  const detailTabs = useMemo(
    () => [
      ...openInvoiceTabs.map((tab) => ({ ...tab, component: InvoicingPage, closable: true })),
      ...openBillTabs.map((tab) => ({ ...tab, component: BillingPage, closable: true }))
    ],
    [openBillTabs, openInvoiceTabs]
  );
  const navigationTabs = useMemo(
    () => (hasAuthSession ? baseTabs.filter((tab) => tab.id !== "login") : baseTabs.filter((tab) => tab.id === "login")),
    [hasAuthSession]
  );
  const tabs = useMemo(
    () => (hasAuthSession ? [...navigationTabs, ...detailTabs] : navigationTabs),
    [detailTabs, hasAuthSession, navigationTabs]
  );
  const activeTabDef = tabs.find((tab) => tab.id === activeTab) || baseTabs[0];
  const ActiveComponent = activeTabDef.component;
  const tabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);
  const isInvoicingTab =
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
    setActiveTab(hasAuthSession ? "books" : "login");
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
        openBillTabs
      })
    );
  }, [activeTab, lastNonLedgerTab, ledgerTargetAccountId, openInvoiceTabs, openBillTabs]);

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

  const closeDynamicTab = (tabId) => {
    const currentIds = tabs.map((tab) => tab.id);
    const currentIndex = currentIds.indexOf(tabId);
    const fallbackTab = currentIndex > 0 ? currentIds[currentIndex - 1] : "books";

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
      setActiveTab("books");
      return;
    }
    const meRes = await api.get("/auth/me");
    if (meRes.ok) {
      setHasAuthSession(true);
      setCurrentUser(meRes.data);
      setActiveTab("books");
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
    (lastNonLedgerTab === "invoicing-list" ||
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
              onOpenInvoicingList: () => setActiveTab("invoicing-list"),
              onOpenInvoiceTab: handleOpenInvoicing,
              onInvoiceDeleted: () => closeDynamicTab(activeTab),
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
              onOpenBillingList: () => setActiveTab("billing-list"),
              onOpenBillTab: handleOpenBilling,
              onBillDeleted: () => closeDynamicTab(activeTab),
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
            <h1 className="brand-title">GnuCash Web</h1>
            <div className="small-muted">API: {apiBase()}</div>
          </div>
          <div className="d-flex align-items-center gap-2">
            {hasAuthSession && currentUser ? (
              <span className="small-muted">Usuário: {currentUser.full_name || currentUser.email}</span>
            ) : hasAuthSession ? (
              <span className="small-muted">Sessão autenticada</span>
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

      <main className={`container-fluid app-main-container py-4 ${isInvoicingTab ? "is-invoicing" : ""}`}>
        <ul className="nav nav-pills mb-4 flex-wrap gap-1">
          {tabs.map((tab) => (
            <li key={tab.id} className={`nav-item app-tab-item ${tab.closable ? "is-closable" : ""}`}>
              <button
                className={`nav-link ${activeTab === tab.id ? "active" : ""}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
              {tab.closable ? (
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
              ) : null}
            </li>
          ))}
        </ul>

        <div className="section-card">
          <ActiveComponent key={activeTab} {...activeProps} />
        </div>
      </main>
    </div>
  );
}
