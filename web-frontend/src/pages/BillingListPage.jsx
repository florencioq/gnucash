import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";

function rationalToNumber(num, denom) {
  const d = Number(denom) || 1;
  return Number(num || 0) / d;
}

function formatDateDisplay(value) {
  if (!value) return "-";
  const ymd = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

function formatMoney(num, denom, mnemonic) {
  const value = rationalToNumber(num, denom);
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return mnemonic ? `${mnemonic} ${formatted}` : formatted;
}

function invoicePaymentState(invoice) {
  const openAmount = Math.abs(rationalToNumber(invoice.open_amount_num, invoice.open_amount_denom));
  const totalAmount = Math.abs(rationalToNumber(invoice.total_num, invoice.total_denom));
  const epsilon = 1e-9;

  if (openAmount <= epsilon) return "PAID";
  if (totalAmount > epsilon && openAmount < (totalAmount - epsilon)) return "PARTIAL";
  return "UNPAID";
}

function isoDateOnly(value) {
  if (!value) return "";
  const ymd = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateInRange(isoDate, startDate, endDate) {
  if (!isoDate) return false;
  if (startDate && isoDate < startDate) return false;
  if (endDate && isoDate > endDate) return false;
  return true;
}

function paymentStateLabel(state) {
  if (state === "PAID") return "Paga";
  if (state === "PARTIAL") return "Parcial";
  return "Não paga";
}

const PAYMENT_STATE_ORDER = {
  UNPAID: 0,
  PARTIAL: 1,
  PAID: 2
};

export default function BillingListPage({ onOpenBilling = null }) {
  const [commodities, setCommodities] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();

  const [vendorFilterGuid, setVendorFilterGuid] = useState("");
  const [postedFilter, setPostedFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [postedStartDate, setPostedStartDate] = useState("");
  const [postedEndDate, setPostedEndDate] = useState("");
  const [sortKey, setSortKey] = useState("date_opened");
  const [sortDirection, setSortDirection] = useState("desc");

  const commoditiesById = useMemo(
    () => new Map(commodities.map((commodity) => [commodity.id, commodity])),
    [commodities]
  );
  const vendorsById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.guid, vendor])),
    [vendors]
  );

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (vendorFilterGuid && invoice.vendor_guid !== vendorFilterGuid) return false;

      if (postedFilter === "POSTED" && !invoice.date_posted) return false;
      if (postedFilter === "UNPOSTED" && invoice.date_posted) return false;

      if (postedStartDate || postedEndDate) {
        const postedDate = isoDateOnly(invoice.date_posted);
        if (!dateInRange(postedDate, postedStartDate, postedEndDate)) return false;
      }

      if (paymentFilter !== "ALL") {
        const paymentState = invoicePaymentState(invoice);
        if (paymentState !== paymentFilter) return false;
      }

      return true;
    });
  }, [
    invoices,
    vendorFilterGuid,
    postedFilter,
    paymentFilter,
    postedStartDate,
    postedEndDate
  ]);

  const sortedInvoices = useMemo(() => {
    const getSortValue = (invoice) => {
      switch (sortKey) {
        case "id":
          return String(invoice.id || "").toLowerCase();
        case "vendor":
          return String(vendorsById.get(invoice.vendor_guid)?.name || "").toLowerCase();
        case "date_opened":
          return isoDateOnly(invoice.date_opened);
        case "date_posted":
          return isoDateOnly(invoice.date_posted);
        case "posted_status":
          return invoice.date_posted ? 1 : 0;
        case "payment_status":
          return PAYMENT_STATE_ORDER[invoicePaymentState(invoice)] || 0;
        case "total":
          return Math.abs(rationalToNumber(invoice.total_num, invoice.total_denom));
        case "open":
          return Math.abs(rationalToNumber(invoice.open_amount_num, invoice.open_amount_denom));
        default:
          return "";
      }
    };

    const direction = sortDirection === "asc" ? 1 : -1;
    return filteredInvoices.slice().sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      if (typeof aValue === "number" && typeof bValue === "number") {
        if (aValue < bValue) return -1 * direction;
        if (aValue > bValue) return 1 * direction;
      } else {
        const aText = String(aValue || "");
        const bText = String(bValue || "");
        const compared = aText.localeCompare(bText, "pt-BR");
        if (compared !== 0) return compared * direction;
      }

      return String(a.guid || "").localeCompare(String(b.guid || ""), "pt-BR");
    });
  }, [filteredInvoices, sortDirection, sortKey, vendorsById]);

  const sortIndicator = (key) => {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const setSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const loadCommodities = async () => {
    const response = await api.get("/commodities?namespace=CURRENCY");
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setCommodities(response.data);
  };

  const loadVendors = async (bookId) => {
    const response = await api.get(`/vendors?book_id=${bookId}`);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setVendors(response.data);
  };

  const loadInvoices = async (bookId) => {
    const response = await api.get(`/bills?book_id=${bookId}`);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setError(null);
    setInvoices(response.data);
  };

  useEffect(() => {
    loadCommodities();
  }, []);

  useEffect(() => {
    if (!activeBookId) return;
    loadVendors(activeBookId);
    loadInvoices(activeBookId);
  }, [activeBookId]);

  useEffect(() => {
    if (!vendorFilterGuid) return;
    if (vendors.some((vendor) => vendor.guid === vendorFilterGuid)) return;
    setVendorFilterGuid("");
  }, [vendors, vendorFilterGuid]);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Compras</h2>
          <div className="small-muted">Lista de compras com filtros e ordenação.</div>
        </div>
      </div>

      {activeBook ? (
        <div className="small-muted mb-3">Book ativo: {activeBook.name || activeBook.id}</div>
      ) : (
        <div className="alert alert-warning" role="alert">
          Nenhum book ativo. Defina um em Books para continuar.
        </div>
      )}

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Filtro por fornecedor</label>
          <select
            className="form-select"
            value={vendorFilterGuid}
            onChange={(event) => setVendorFilterGuid(event.target.value)}
            disabled={!activeBookId || vendors.length === 0}
          >
            <option value="">Todos</option>
            {vendors.map((vendor) => (
              <option key={vendor.guid} value={vendor.guid}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Filtro por postagem</label>
          <select
            className="form-select"
            value={postedFilter}
            onChange={(event) => setPostedFilter(event.target.value)}
            disabled={!activeBookId}
          >
            <option value="ALL">Todas</option>
            <option value="POSTED">Postadas</option>
            <option value="UNPOSTED">Não postadas</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Filtro por pagamento</label>
          <select
            className="form-select"
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            disabled={!activeBookId}
          >
            <option value="ALL">Todas</option>
            <option value="PAID">Pagas</option>
            <option value="UNPAID">Não pagas</option>
            <option value="PARTIAL">Parciais</option>
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Postagem: data inicial</label>
          <input
            type="date"
            className="form-control"
            value={postedStartDate}
            onChange={(event) => setPostedStartDate(event.target.value)}
            disabled={!activeBookId}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Postagem: data final</label>
          <input
            type="date"
            className="form-control"
            value={postedEndDate}
            onChange={(event) => setPostedEndDate(event.target.value)}
            disabled={!activeBookId}
          />
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error.code}: {error.message}
        </div>
      ) : null}
      {!error && activeBookError ? (
        <div className="alert alert-danger" role="alert">
          {activeBookError.code}: {activeBookError.message}
        </div>
      ) : null}

      <div className="table-responsive">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => setSort("id")}>
                  Número {sortIndicator("id")}
                </button>
              </th>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => setSort("vendor")}>
                  Fornecedor {sortIndicator("vendor")}
                </button>
              </th>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => setSort("date_opened")}>
                  Abertura {sortIndicator("date_opened")}
                </button>
              </th>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => setSort("date_posted")}>
                  Postagem {sortIndicator("date_posted")}
                </button>
              </th>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => setSort("posted_status")}>
                  Status Postagem {sortIndicator("posted_status")}
                </button>
              </th>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => setSort("payment_status")}>
                  Status Pagamento {sortIndicator("payment_status")}
                </button>
              </th>
              <th className="text-end">
                <button type="button" className="table-sort-btn is-numeric" onClick={() => setSort("total")}>
                  Total {sortIndicator("total")}
                </button>
              </th>
              <th className="text-end">
                <button type="button" className="table-sort-btn is-numeric" onClick={() => setSort("open")}>
                  Em Aberto {sortIndicator("open")}
                </button>
              </th>
              <th className="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedInvoices.map((invoice) => {
              const vendor = vendorsById.get(invoice.vendor_guid);
              const paymentState = invoicePaymentState(invoice);
              const mnemonic = commoditiesById.get(invoice.currency_guid)?.mnemonic || "";

              return (
                <tr key={invoice.guid}>
                  <td>{invoice.id || "-"}</td>
                  <td>{vendor?.name || "fornecedor não encontrado"}</td>
                  <td>{formatDateDisplay(invoice.date_opened)}</td>
                  <td>{formatDateDisplay(invoice.date_posted)}</td>
                  <td>{invoice.date_posted ? "Postada" : "Não postada"}</td>
                  <td>{paymentStateLabel(paymentState)}</td>
                  <td className="text-end">{formatMoney(invoice.total_num, invoice.total_denom, mnemonic)}</td>
                  <td className="text-end">
                    {formatMoney(invoice.open_amount_num, invoice.open_amount_denom, mnemonic)}
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        if (typeof onOpenBilling === "function") {
                          onOpenBilling({ billGuid: invoice.guid });
                        }
                      }}
                      disabled={typeof onOpenBilling !== "function"}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              );
            })}
            {sortedInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="small-muted">
                  Nenhuma compra para os filtros selecionados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
