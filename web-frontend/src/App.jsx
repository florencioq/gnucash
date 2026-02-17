import React, { useEffect, useMemo, useState } from "react";
import BooksPage from "./pages/BooksPage.jsx";
import CommoditiesPage from "./pages/CommoditiesPage.jsx";
import AccountsPage from "./pages/AccountsPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";
import VendorsPage from "./pages/VendorsPage.jsx";
import LedgerPage from "./pages/LedgerPage.jsx";
import InvoicingListPage from "./pages/InvoicingListPage.jsx";
import InvoicingPage from "./pages/InvoicingPage.jsx";
import BillingListPage from "./pages/BillingListPage.jsx";
import BillingPage from "./pages/BillingPage.jsx";
import IncomeStatementPage from "./pages/IncomeStatementPage.jsx";
import { apiBase } from "./api/client.js";

const APP_TABS_STATE_KEY = "gnucash.app-tabs-state.v1";

const baseTabs = [
  { id: "books", label: "Books", component: BooksPage },
  { id: "commodities", label: "Commodities", component: CommoditiesPage },
  { id: "accounts", label: "Accounts", component: AccountsPage },
  { id: "customers", label: "Customers", component: CustomersPage },
  { id: "vendors", label: "Vendors", component: VendorsPage },
  { id: "ledger", label: "Ledger", component: LedgerPage },
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
      invoiceGuid
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
      billGuid
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
  const [activeTab, setActiveTab] = useState(() => persistedTabsState?.activeTab || "books");
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

  const detailTabs = useMemo(
    () => [
      ...openInvoiceTabs.map((tab) => ({ ...tab, component: InvoicingPage, closable: true })),
      ...openBillTabs.map((tab) => ({ ...tab, component: BillingPage, closable: true }))
    ],
    [openBillTabs, openInvoiceTabs]
  );
  const tabs = useMemo(() => [...baseTabs, ...detailTabs], [detailTabs]);
  const activeTabDef = tabs.find((tab) => tab.id === activeTab) || baseTabs[0];
  const ActiveComponent = activeTabDef.component;
  const tabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);
  const isInvoicingTab =
    activeTab === "invoicing-list" ||
    activeTab === "billing-list" ||
    isInvoiceTab(activeTab) ||
    isBillTab(activeTab);

  useEffect(() => {
    if (activeTab !== "ledger") {
      setLastNonLedgerTab(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (tabIds.has(activeTab)) return;
    setActiveTab("books");
  }, [activeTab, tabIds]);

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

  const handleOpenInvoicing = ({ invoiceGuid, invoiceId } = {}) => {
    if (!invoiceGuid) return;
    const tabId = `invoice:${invoiceGuid}`;
    const label = normalizeLabel("Fatura", invoiceId, invoiceGuid);

    setOpenInvoiceTabs((current) => {
      let found = false;
      const updated = current.map((tab) => {
        if (tab.id !== tabId) return tab;
        found = true;
        return tab.label === label ? tab : { ...tab, label };
      });
      if (found) return updated;
      return [...updated, { id: tabId, label, invoiceGuid }];
    });
    setActiveTab(tabId);
  };

  const handleOpenBilling = ({ billGuid, billId } = {}) => {
    if (!billGuid) return;
    const tabId = `bill:${billGuid}`;
    const label = normalizeLabel("Compra", billId, billGuid);

    setOpenBillTabs((current) => {
      let found = false;
      const updated = current.map((tab) => {
        if (tab.id !== tabId) return tab;
        found = true;
        return tab.label === label ? tab : { ...tab, label };
      });
      if (found) return updated;
      return [...updated, { id: tabId, label, billGuid }];
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

  const ledgerReturnTab =
    (lastNonLedgerTab === "invoicing-list" ||
      lastNonLedgerTab === "billing-list" ||
      isInvoiceTab(lastNonLedgerTab) ||
      isBillTab(lastNonLedgerTab)) &&
    tabIds.has(lastNonLedgerTab)
      ? lastNonLedgerTab
      : "";

  const activeProps =
    activeTab === "accounts"
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
            onOpenBilling: ({ billGuid, billId }) =>
              handleOpenInvoicing({ invoiceGuid: billGuid, invoiceId: billId })
          }
      : activeTab === "billing-list"
        ? {
            onOpenBilling: handleOpenBilling,
            onOpenInvoicing: ({ invoiceGuid, invoiceId }) =>
              handleOpenBilling({ billGuid: invoiceGuid, billId: invoiceId })
          }
      : isInvoiceTab(activeTab)
        ? {
            initialInvoiceGuid: invoiceGuidFromTab(activeTab),
            onOpenInvoicingList: () => setActiveTab("invoicing-list")
          }
      : isBillTab(activeTab)
        ? {
            initialBillGuid: billGuidFromTab(activeTab),
            onOpenBillingList: () => setActiveTab("billing-list")
          }
        : {};

  return (
    <div className="app-shell">
      <header className="brand-bar">
        <div className="container">
          <h1 className="brand-title">GnuCash Web</h1>
          <div className="small-muted">API: {apiBase()}</div>
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
