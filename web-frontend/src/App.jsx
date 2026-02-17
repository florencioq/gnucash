import React, { useEffect, useState } from "react";
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

const tabs = [
  { id: "books", label: "Books", component: BooksPage },
  { id: "commodities", label: "Commodities", component: CommoditiesPage },
  { id: "accounts", label: "Accounts", component: AccountsPage },
  { id: "customers", label: "Customers", component: CustomersPage },
  { id: "vendors", label: "Vendors", component: VendorsPage },
  { id: "ledger", label: "Ledger", component: LedgerPage },
  { id: "income-statement", label: "DRE Mensal", component: IncomeStatementPage },
  { id: "invoicing-list", label: "Faturamentos", component: InvoicingListPage },
  { id: "invoicing", label: "Fatura", component: InvoicingPage },
  { id: "billing-list", label: "Compras", component: BillingListPage },
  { id: "billing", label: "Compra", component: BillingPage }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("books");
  const [lastNonLedgerTab, setLastNonLedgerTab] = useState("books");
  const [ledgerTargetAccountId, setLedgerTargetAccountId] = useState("");
  const [invoicingTargetInvoiceGuid, setInvoicingTargetInvoiceGuid] = useState("");
  const [billingTargetBillGuid, setBillingTargetBillGuid] = useState("");
  const ActiveComponent = tabs.find((tab) => tab.id === activeTab).component;
  const isInvoicingTab =
    activeTab === "invoicing-list" ||
    activeTab === "invoicing" ||
    activeTab === "billing-list" ||
    activeTab === "billing";

  useEffect(() => {
    if (activeTab !== "ledger") {
      setLastNonLedgerTab(activeTab);
    }
  }, [activeTab]);

  const handleOpenLedger = ({ accountId }) => {
    setLedgerTargetAccountId(accountId || "");
    setActiveTab("ledger");
  };

  const handleOpenInvoicing = ({ invoiceGuid }) => {
    setInvoicingTargetInvoiceGuid(invoiceGuid || "");
    setActiveTab("invoicing");
  };

  const handleOpenBilling = ({ billGuid }) => {
    setBillingTargetBillGuid(billGuid || "");
    setActiveTab("billing");
  };

  const ledgerReturnTab =
    lastNonLedgerTab === "invoicing-list" ||
    lastNonLedgerTab === "invoicing" ||
    lastNonLedgerTab === "billing-list" ||
    lastNonLedgerTab === "billing"
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
            onOpenBilling: ({ billGuid }) => handleOpenInvoicing({ invoiceGuid: billGuid })
          }
      : activeTab === "invoicing"
        ? {
            initialInvoiceGuid: invoicingTargetInvoiceGuid,
            onOpenInvoicingList: () => setActiveTab("invoicing-list")
          }
      : activeTab === "billing-list"
        ? {
            onOpenBilling: handleOpenBilling,
            onOpenInvoicing: ({ invoiceGuid }) => handleOpenBilling({ billGuid: invoiceGuid })
          }
      : activeTab === "billing"
        ? {
            initialBillGuid: billingTargetBillGuid,
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
        <ul className="nav nav-pills mb-4">
          {tabs.map((tab) => (
            <li key={tab.id} className="nav-item">
              <button
                className={`nav-link ${activeTab === tab.id ? "active" : ""}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
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
