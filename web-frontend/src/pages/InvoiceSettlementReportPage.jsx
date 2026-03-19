import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";
import { useToolbar } from "../context/ToolbarContext.jsx";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const REPORT_STATE_KEY = "gnucash.invoice-settlement-report-state.v2";

function loadPersistedState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(REPORT_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatDateDisplay(value) {
  if (!value) return "-";
  const ymd = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

function formatDays(value) {
  const numeric = Number(value || 0);
  return `${numeric > 0 ? "+" : ""}${numeric}`;
}

function rationalToNumber(num, denom) {
  const d = Number(denom) || 1;
  return Number(num || 0) / d;
}

function formatMoney(num, denom, mnemonic) {
  const value = rationalToNumber(num, denom);
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return mnemonic ? `${mnemonic} ${formatted}` : formatted;
}

function paymentStatusLabel(status) {
  return status === "PAID" ? "Quitada" : "Não quitada";
}

export default function InvoiceSettlementReportPage({ onOpenInvoicing = null, isActive = false }) {
  const persistedState = useMemo(() => loadPersistedState(), []);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();
  const [commodities, setCommodities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [items, setItems] = useState([]);
  const [customerSummaries, setCustomerSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [customerFilterGuid, setCustomerFilterGuid] = useState(
    () => String(persistedState?.customerFilterGuid || "")
  );
  const [postedStartDate, setPostedStartDate] = useState(() => String(persistedState?.postedStartDate || ""));
  const [postedEndDate, setPostedEndDate] = useState(() => String(persistedState?.postedEndDate || ""));
  const [sortKey, setSortKey] = useState(() => String(persistedState?.sortKey || "posted_month_end_date"));
  const [sortDirection, setSortDirection] = useState(() => String(persistedState?.sortDirection || "asc"));
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

  const overallAverageDays = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const summary of customerSummaries) {
      const invoiceCount = Number(summary.invoice_count || 0);
      const average = Number(summary.avg_days_difference || 0);
      sum += average * invoiceCount;
      count += invoiceCount;
    }
    return count > 0 ? sum / count : 0;
  }, [customerSummaries]);

  const loadCustomers = async (bookId) => {
    setCustomersLoaded(false);
    const response = await api.get(`/customers?book_id=${bookId}`);
    if (!response.ok) {
      setError(response.error);
      setCustomersLoaded(true);
      return;
    }
    setCustomers(response.data || []);
    setCustomersLoaded(true);
  };

  const loadCommodities = async () => {
    const response = await api.get("/commodities?namespace=CURRENCY");
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setCommodities(response.data || []);
  };

  const loadReport = async (bookId) => {
    const params = new URLSearchParams({
      book_id: bookId,
      sort_key: sortKey,
      sort_direction: sortDirection,
      page: String(page),
      page_size: String(pageSize),
    });
    if (customerFilterGuid) params.set("customer_guid", customerFilterGuid);
    if (postedStartDate) params.set("posted_start_date", postedStartDate);
    if (postedEndDate) params.set("posted_end_date", postedEndDate);

    setLoading(true);
    const response = await api.get(`/reports/invoices/settlement-by-customer?${params.toString()}`);
    setLoading(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setError(null);
    setItems(response.data.items || []);
    setCustomerSummaries(response.data.customer_summaries || []);
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
    loadReport(activeBookId);
  }, [
    activeBookId,
    customerFilterGuid,
    postedStartDate,
    postedEndDate,
    sortKey,
    sortDirection,
    page,
    pageSize,
  ]);

  useEffect(() => {
    if (!customersLoaded) return;
    if (!customerFilterGuid) return;
    if (customers.some((customer) => customer.guid === customerFilterGuid)) return;
    setCustomerFilterGuid("");
  }, [customersLoaded, customers, customerFilterGuid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      REPORT_STATE_KEY,
      JSON.stringify({
        customerFilterGuid,
        postedStartDate,
        postedEndDate,
        sortKey,
        sortDirection,
        page,
        pageSize,
      })
    );
  }, [customerFilterGuid, postedStartDate, postedEndDate, sortKey, sortDirection, page, pageSize]);

  const openInvoice = (item) => {
    if (typeof onOpenInvoicing !== "function" || !item?.invoice_guid) return;
    onOpenInvoicing({ invoiceGuid: item.invoice_guid, invoiceId: item.invoice_id || "" });
  };

  const { registerToolbar } = useToolbar();

  useEffect(() => {
    if (!isActive) return;
    registerToolbar(
      <div>
        <h2 className="mb-1">Prazo de Quitação de Faturamentos</h2>
        <div className="small-muted">
          Diferença em dias entre o fim do mês da postagem e a data de quitação (ou hoje, para não quitadas), com visão por cliente.
        </div>
      </div>
    );
    return () => registerToolbar(null);
  }, [isActive, registerToolbar]);

  return (
    <div>
      {activeBook ? (
        <div className="small-muted mb-3">Livro ativo: {activeBook.name || activeBook.id}</div>
      ) : (
        <div className="alert alert-warning" role="alert">
          Nenhum livro ativo. Defina um em Livros para continuar.
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
        <div className="col-md-3">
          <label className="form-label">Postagem: início</label>
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
          <label className="form-label">Postagem: fim</label>
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
        <div className="col-md-2 d-flex align-items-end">
          <div className="small-muted">
            Média geral: <strong>{formatDays(overallAverageDays.toFixed(2))} dias</strong>
          </div>
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

      <h3 className="h5 mb-2">Resumo por cliente</h3>
      <div className="table-responsive mb-3">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Cliente</th>
              <th className="text-end">Faturas</th>
              <th className="text-end">Média (dias)</th>
              <th className="text-end">Mínimo (dias)</th>
              <th className="text-end">Máximo (dias)</th>
            </tr>
          </thead>
          <tbody>
            {customerSummaries.map((summary) => (
              <tr key={summary.customer_guid}>
                <td>{summary.customer_name || "cliente não encontrado"}</td>
                <td className="text-end">{summary.invoice_count}</td>
                <td className="text-end">{formatDays(summary.avg_days_difference)}</td>
                <td className="text-end">{formatDays(summary.min_days_difference)}</td>
                <td className="text-end">{formatDays(summary.max_days_difference)}</td>
              </tr>
            ))}
            {customerSummaries.length === 0 ? (
              <tr>
                <td colSpan={5} className="small-muted">
                  Nenhum cliente com faturamento postado para os filtros selecionados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h3 className="h5 mb-2">Detalhamento por faturamento postado</h3>
      <div className="table-responsive">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => setSort("customer")}>
                  Cliente {sortIndicator("customer")}
                </button>
              </th>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => setSort("invoice_id")}>
                  Fatura {sortIndicator("invoice_id")}
                </button>
              </th>
              <th className="text-end">Valor</th>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => setSort("date_posted")}>
                  Postagem {sortIndicator("date_posted")}
                </button>
              </th>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => setSort("posted_month_end_date")}>
                  Fim do mês {sortIndicator("posted_month_end_date")}
                </button>
              </th>
              <th>
                <button type="button" className="table-sort-btn" onClick={() => setSort("settled_date")}>
                  Quitação / Hoje {sortIndicator("settled_date")}
                </button>
              </th>
              <th>Status</th>
              <th className="text-end">
                <button type="button" className="table-sort-btn is-numeric" onClick={() => setSort("days_difference")}>
                  Dif. dias {sortIndicator("days_difference")}
                </button>
              </th>
              <th className="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="small-muted">
                  Carregando relatório...
                </td>
              </tr>
            ) : null}
            {!loading
              ? items.map((item) => (
                  <tr key={item.invoice_guid}>
                    <td>{item.customer_name || "cliente não encontrado"}</td>
                    <td>{item.invoice_id || "-"}</td>
                    <td className="text-end">
                      {formatMoney(
                        item.total_num,
                        item.total_denom,
                        commoditiesById.get(item.currency_guid)?.mnemonic || ""
                      )}
                    </td>
                    <td>{formatDateDisplay(item.date_posted)}</td>
                    <td>{formatDateDisplay(item.posted_month_end_date)}</td>
                    <td>{formatDateDisplay(item.settled_date)}</td>
                    <td>{paymentStatusLabel(item.payment_status)}</td>
                    <td className="text-end">{formatDays(item.days_difference)}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => openInvoice(item)}
                        disabled={typeof onOpenInvoicing !== "function"}
                      >
                        Abrir fatura
                      </button>
                    </td>
                  </tr>
                ))
              : null}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={9} className="small-muted">
                  Nenhum faturamento postado para os filtros selecionados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
        <div className="small-muted">
          Mostrando {items.length} de {totalItems} faturamentos postados
        </div>
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
