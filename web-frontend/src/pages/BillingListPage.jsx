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

function paymentStateLabel(state) {
  if (state === "PAID") return "Paga";
  if (state === "PARTIAL") return "Parcial";
  return "Não paga";
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const BILLING_LIST_STATE_KEY = "gnucash.billing-list-state.v1";

function loadBillingListState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BILLING_LIST_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function BillingListPage({
  onOpenBilling = null,
  onOpenInvoicing = null,
  onCreateBilling = null
}) {
  const persistedState = useMemo(() => loadBillingListState(), []);
  const [commodities, setCommodities] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoaded, setVendorsLoaded] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();

  const [vendorFilterGuid, setVendorFilterGuid] = useState(() => String(persistedState?.vendorFilterGuid || ""));
  const [postedFilter, setPostedFilter] = useState(() => String(persistedState?.postedFilter || "ALL"));
  const [paymentFilter, setPaymentFilter] = useState(() => String(persistedState?.paymentFilter || "ALL"));
  const [postedStartDate, setPostedStartDate] = useState(() => String(persistedState?.postedStartDate || ""));
  const [postedEndDate, setPostedEndDate] = useState(() => String(persistedState?.postedEndDate || ""));
  const [sortKey, setSortKey] = useState(() => String(persistedState?.sortKey || "date_opened"));
  const [sortDirection, setSortDirection] = useState(() => String(persistedState?.sortDirection || "desc"));
  const [page, setPage] = useState(() => Math.max(1, Number(persistedState?.page) || 1));
  const [pageSize, setPageSize] = useState(() => {
    const size = Number(persistedState?.pageSize);
    return PAGE_SIZE_OPTIONS.includes(size) ? size : 25;
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const commoditiesById = useMemo(
    () => new Map(commodities.map((commodity) => [commodity.id, commodity])),
    [commodities]
  );
  const vendorsById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.guid, vendor])),
    [vendors]
  );

  const sortIndicator = (key) => {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const setSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      setPage(1);
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
    setPage(1);
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
    setVendorsLoaded(false);
    const response = await api.get(`/vendors?book_id=${bookId}`);
    if (!response.ok) {
      setError(response.error);
      setVendorsLoaded(true);
      return;
    }
    setVendors(response.data);
    setVendorsLoaded(true);
  };

  const loadInvoices = async (bookId) => {
    const params = new URLSearchParams({
      book_id: bookId,
      posted_filter: postedFilter,
      payment_filter: paymentFilter,
      sort_key: sortKey,
      sort_direction: sortDirection,
      page: String(page),
      page_size: String(pageSize)
    });
    if (vendorFilterGuid) params.set("vendor_guid", vendorFilterGuid);
    if (postedStartDate) params.set("posted_start_date", postedStartDate);
    if (postedEndDate) params.set("posted_end_date", postedEndDate);

    setLoading(true);
    const response = await api.get(`/bills/list?${params.toString()}`);
    setLoading(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setError(null);
    setInvoices(response.data.items || []);
    setPage(response.data.page || 1);
    setPageSize(response.data.page_size || pageSize);
    setTotalItems(response.data.total_items || 0);
    setTotalPages(response.data.total_pages || 1);
  };

  useEffect(() => {
    loadCommodities();
  }, []);

  useEffect(() => {
    if (!activeBookId) return;
    setVendors([]);
    setVendorsLoaded(false);
    loadVendors(activeBookId);
  }, [activeBookId]);

  useEffect(() => {
    if (!activeBookId) return;
    loadInvoices(activeBookId);
  }, [
    activeBookId,
    vendorFilterGuid,
    postedFilter,
    paymentFilter,
    postedStartDate,
    postedEndDate,
    sortKey,
    sortDirection,
    page,
    pageSize
  ]);

  useEffect(() => {
    if (!vendorsLoaded) return;
    if (!vendorFilterGuid) return;
    if (vendors.some((vendor) => vendor.guid === vendorFilterGuid)) return;
    setVendorFilterGuid("");
  }, [vendorsLoaded, vendors, vendorFilterGuid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const state = {
      vendorFilterGuid,
      postedFilter,
      paymentFilter,
      postedStartDate,
      postedEndDate,
      sortKey,
      sortDirection,
      page,
      pageSize
    };
    window.sessionStorage.setItem(BILLING_LIST_STATE_KEY, JSON.stringify(state));
  }, [
    vendorFilterGuid,
    postedFilter,
    paymentFilter,
    postedStartDate,
    postedEndDate,
    sortKey,
    sortDirection,
    page,
    pageSize
  ]);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Compras</h2>
          <div className="small-muted">Lista de compras com filtros e ordenação.</div>
        </div>
        {typeof onCreateBilling === "function" ? (
          <button
            type="button"
            className="btn btn-accent"
            onClick={onCreateBilling}
            disabled={!activeBookId}
          >
            Nova Compra
          </button>
        ) : null}
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
            onChange={(event) => {
              setVendorFilterGuid(event.target.value);
              setPage(1);
            }}
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
            onChange={(event) => {
              setPostedFilter(event.target.value);
              setPage(1);
            }}
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
            onChange={(event) => {
              setPaymentFilter(event.target.value);
              setPage(1);
            }}
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
            onChange={(event) => {
              setPostedStartDate(event.target.value);
              setPage(1);
            }}
            disabled={!activeBookId}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Postagem: data final</label>
          <input
            type="date"
            className="form-control"
            value={postedEndDate}
            onChange={(event) => {
              setPostedEndDate(event.target.value);
              setPage(1);
            }}
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
            {loading ? (
              <tr>
                <td colSpan={9} className="small-muted">
                  Carregando compras...
                </td>
              </tr>
            ) : null}
            {!loading ? invoices.map((invoice) => {
              const vendorName = invoice.vendor_name || vendorsById.get(invoice.vendor_guid)?.name;
              const paymentState = invoice.payment_status || "UNPAID";
              const mnemonic = commoditiesById.get(invoice.currency_guid)?.mnemonic || "";

              return (
                <tr key={invoice.guid}>
                  <td>{invoice.id || "-"}</td>
                  <td>{vendorName || "fornecedor não encontrado"}</td>
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
                        if (!invoice.guid) return;
                        if (typeof onOpenBilling === "function") {
                          onOpenBilling({ billGuid: invoice.guid, billId: invoice.id || "" });
                          return;
                        }
                        if (typeof onOpenInvoicing === "function") {
                          onOpenInvoicing({ invoiceGuid: invoice.guid, invoiceId: invoice.id || "" });
                        }
                      }}
                      disabled={
                        !invoice.guid ||
                        (typeof onOpenBilling !== "function" && typeof onOpenInvoicing !== "function")
                      }
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              );
            }) : null}
            {!loading && invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="small-muted">
                  Nenhuma compra para os filtros selecionados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
        <div className="small-muted">Mostrando {invoices.length} de {totalItems} compras</div>
        <div className="d-flex align-items-center gap-2">
          <label className="form-label mb-0 small-muted">Itens por página</label>
          <select
            className="form-select form-select-sm"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value) || 25);
              setPage(1);
            }}
            disabled={!activeBookId}
            style={{ width: "96px" }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setPage(1)}
            disabled={!activeBookId || loading || page <= 1}
          >
            Primeira
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={!activeBookId || loading || page <= 1}
          >
            Anterior
          </button>
          <span className="small-muted">
            Página {totalItems === 0 ? 0 : page} de {totalItems === 0 ? 0 : totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={!activeBookId || loading || page >= totalPages || totalItems === 0}
          >
            Próxima
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setPage(totalPages)}
            disabled={!activeBookId || loading || page >= totalPages || totalItems === 0}
          >
            Última
          </button>
        </div>
      </div>
    </div>
  );
}
