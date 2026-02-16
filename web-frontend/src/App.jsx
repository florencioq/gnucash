import React, { useState } from "react";
import BooksPage from "./pages/BooksPage.jsx";
import CommoditiesPage from "./pages/CommoditiesPage.jsx";
import AccountsPage from "./pages/AccountsPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";
import VendorsPage from "./pages/VendorsPage.jsx";
import LedgerPage from "./pages/LedgerPage.jsx";
import { apiBase } from "./api/client.js";

const tabs = [
  { id: "books", label: "Books", component: BooksPage },
  { id: "commodities", label: "Commodities", component: CommoditiesPage },
  { id: "accounts", label: "Accounts", component: AccountsPage },
  { id: "customers", label: "Customers", component: CustomersPage },
  { id: "vendors", label: "Vendors", component: VendorsPage },
  { id: "ledger", label: "Ledger", component: LedgerPage }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("books");
  const [ledgerTarget, setLedgerTarget] = useState({ bookId: "", accountId: "" });
  const ActiveComponent = tabs.find((tab) => tab.id === activeTab).component;

  const handleOpenLedger = ({ bookId, accountId }) => {
    setLedgerTarget({ bookId, accountId });
    setActiveTab("ledger");
  };

  const activeProps =
    activeTab === "accounts"
      ? { onOpenLedger: handleOpenLedger }
      : activeTab === "ledger"
        ? { initialBookId: ledgerTarget.bookId, initialAccountId: ledgerTarget.accountId }
        : {};

  return (
    <div className="app-shell">
      <header className="brand-bar">
        <div className="container">
          <h1 className="brand-title">GnuCash Web</h1>
          <div className="small-muted">API: {apiBase()}</div>
        </div>
      </header>

      <main className="container py-4">
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
          <ActiveComponent {...activeProps} />
        </div>
      </main>
    </div>
  );
}
