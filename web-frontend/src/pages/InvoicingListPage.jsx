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
const INVOICING_LIST_STATE_KEY = "gnucash.invoicing-list-state.v1";

function loadInvoicingListState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(INVOICING_LIST_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function InvoicingListPage({ onOpenInvoicing = null, onOpenBilling = null }) {
  const persistedState = useMemo(() => loadInvoicingListState(), []);
  const [commodities, setCommodities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();

  const [customerFilterGuid, setCustomerFilterGuid] = useState(() => String(persistedState?.customerFilterGuid || ""));
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
  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.guid, customer])),
    [customers]
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

  const loadCustomers = async (bookId) => {
    setCustomersLoaded(false);
    const response = await api.get(`/customers?book_id=${bookId}`);
    if (!response.ok) {
      setError(response.error);
      setCustomersLoaded(true);
      return;
    }
    setCustomers(response.data);
    setCustomersLoaded(true);
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
    if (customerFilterGuid) params.set("customer_guid", customerFilterGuid);
    if (postedStartDate) params.set("posted_start_date", postedStartDate);
    if (postedEndDate) params.set("posted_end_date", postedEndDate);

    setLoading(true);
    const response = await api.get(`/invoices/list?${params.toString()}`);
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
    setCustomers([]);
    setCustomersLoaded(false);
    loadCustomers(activeBookId);
  }, [activeBookId]);

  useEffect(() => {
    if (!activeBookId) return;
    loadInvoices(activeBookId);
  }, [
    activeBookId,
    customerFilterGuid,
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
    if (!customersLoaded) return;
    if (!customerFilterGuid) return;
    if (customers.some((customer) => customer.guid === customerFilterGuid)) return;
    setCustomerFilterGuid("");
  }, [customersLoaded, customers, customerFilterGuid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const state = {
      customerFilterGuid,
      postedFilter,
      paymentFilter,
      postedStartDate,
      postedEndDate,
      sortKey,
      sortDirection,
      page,
      pageSize
    };
    window.sessionStorage.setItem(INVOICING_LIST_STATE_KEY, JSON.stringify(state));
  }, [
    customerFilterGuid,
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
          <h2 className="mb-1">Faturamentos</h2>
          <div className="small-muted">Lista de faturas com filtros e ordenação.</div>
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
          <label className="form-label">Filtro por cliente</label>
          <select
            className="form-select"
            value={customerFilterGuid}
            onChange={(event) => {
              setCustomerFilterGuid(event.target.value);
              setPage(1);
            }}
            disabled={!activeBookId || customers.length === 0}
          >
            <option value="">Todos</option>
            {customers.map((customer) => (
              <option key={customer.guid} value={customer.guid}>
                {customer.name}
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
                <button type="button" className="table-sort-btn" onClick={() => setSort("customer")}>
                  Cliente {sortIndicator("customer")}
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
                  Carregando faturas...
                </td>
              </tr>
            ) : null}
            {!loading ? invoices.map((invoice) => {
              const customerName = invoice.customer_name || customersById.get(invoice.customer_guid)?.name;
              const paymentState = invoice.payment_status || "UNPAID";
              const mnemonic = commoditiesById.get(invoice.currency_guid)?.mnemonic || "";

              return (
                <tr key={invoice.guid}>
                  <td>{invoice.id || "-"}</td>
                  <td>{customerName || "cliente não encontrado"}</td>
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
                        if (typeof onOpenInvoicing === "function") {
                          onOpenInvoicing({ invoiceGuid: invoice.guid });
                          return;
                        }
                        if (typeof onOpenBilling === "function") {
                          onOpenBilling({ billGuid: invoice.guid });
                        }
                      }}
                      disabled={
                        !invoice.guid ||
                        (typeof onOpenInvoicing !== "function" && typeof onOpenBilling !== "function")
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
                  Nenhuma fatura para os filtros selecionados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
        <div className="small-muted">Mostrando {invoices.length} de {totalItems} faturamentos</div>
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
