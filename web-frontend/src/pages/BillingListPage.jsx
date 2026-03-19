import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";
import { useToolbar } from "../context/ToolbarContext.jsx";

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

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  onCreateBilling = null,
  isActive = false
}) {
  const persistedState = useMemo(() => loadBillingListState(), []);
  const [commodities, setCommodities] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoaded, setVendorsLoaded] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
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
  const [rebuyingGuid, setRebuyingGuid] = useState(null);

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
  }, [activeBookId, refreshToken]);

  useEffect(() => {
    if (!activeBookId) return;
    loadInvoices(activeBookId);
  }, [
    activeBookId,
    refreshToken,
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
  const refreshing = loading || !vendorsLoaded;
  const { registerToolbar } = useToolbar();

  useEffect(() => {
    if (!isActive) return;
    registerToolbar(
      <div className="d-flex align-items-center justify-content-between w-100">
        <div>
          <h2 className="mb-1">Compras</h2>
          <div className="small-muted">Lista de compras com filtros e ordenação.</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setRefreshToken((current) => current + 1)}
            disabled={!activeBookId || refreshing}
          >
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
          {typeof onCreateBilling === "function" ? (
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={onCreateBilling}
              disabled={!activeBookId}
            >
              Nova Compra
            </button>
          ) : null}
        </div>
      </div>
    );
    return () => registerToolbar(null);
  }, [isActive, registerToolbar, activeBookId, refreshing, onCreateBilling]);

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

  const rebuyToday = async (invoice) => {
    if (!activeBookId || !invoice?.guid || rebuyingGuid) return;
    const today = todayIsoDate();
    setRebuyingGuid(invoice.guid);
    setError(null);
    try {
      const detailResponse = await api.get(`/bills/${invoice.guid}`);
      if (!detailResponse.ok) {
        setError(detailResponse.error);
        return;
      }
      const sourceBill = detailResponse.data;

      const createPayload = {
        book_id: activeBookId,
        type: sourceBill.type || "INVOICE",
        id: "",
        date_opened: `${today}T00:00:00Z`,
        notes: sourceBill.notes || "",
        currency_guid: sourceBill.currency_guid,
        vendor_guid: sourceBill.vendor_guid,
        billing_id: sourceBill.billing_id || null,
        terms: sourceBill.terms || null
      };
      const createResponse = await api.post("/bills", createPayload);
      if (!createResponse.ok) {
        setError(createResponse.error);
        return;
      }
      const newBill = createResponse.data;

      for (const entry of sourceBill.entries || []) {
        const entryPayload = {
          date: `${today}T00:00:00Z`,
          description: entry.description || null,
          action: entry.action || null,
          notes: entry.notes || null,
          income_account_guid: entry.income_account_guid,
          quantity_num: entry.quantity_num,
          quantity_denom: entry.quantity_denom,
          unit_price_num: entry.unit_price_num,
          unit_price_denom: entry.unit_price_denom,
          discount_num: entry.discount_num,
          discount_denom: entry.discount_denom,
          discount_type: entry.discount_type,
          discount_how: entry.discount_how,
          taxable: Boolean(entry.taxable),
          tax_included: Boolean(entry.tax_included)
        };
        const entryResponse = await api.post(`/bills/${newBill.guid}/entries`, entryPayload);
        if (!entryResponse.ok) {
          setError(entryResponse.error);
          return;
        }
      }

      const postAccountGuid = sourceBill.post_account_guid || activeBook?.default_payables_account_guid || "";
      if (postAccountGuid) {
        const postResponse = await api.post(`/bills/${newBill.guid}/post`, {
          post_account_guid: postAccountGuid,
          post_date: `${today}T00:00:00Z`,
          due_date: `${today}T00:00:00Z`
        });
        if (!postResponse.ok) {
          setError(postResponse.error);
        }
      }

      setRefreshToken((t) => t + 1);
      if (typeof onOpenBilling === "function") {
        onOpenBilling({ billGuid: newBill.guid, billId: newBill.id || "" });
      }
    } finally {
      setRebuyingGuid(null);
    }
  };

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
                <button type="button" className="table-sort-btn" onClick={() => setSort("date_due")}>
                  Vencimento {sortIndicator("date_due")}
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
                <td colSpan={10} className="small-muted">
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
                  <td>{formatDateDisplay(invoice.date_due)}</td>
                  <td>{invoice.date_posted ? "Postada" : "Não postada"}</td>
                  <td>{paymentStateLabel(paymentState)}</td>
                  <td className="text-end">{formatMoney(invoice.total_num, invoice.total_denom, mnemonic)}</td>
                  <td className="text-end">
                    {formatMoney(invoice.open_amount_num, invoice.open_amount_denom, mnemonic)}
                  </td>
                  <td className="text-end">
                    <div className="d-flex gap-1 justify-content-end">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm py-0 px-1"
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
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm py-0 px-1"
                        onClick={() => rebuyToday(invoice)}
                        disabled={!invoice.guid || rebuyingGuid === invoice.guid}
                        title="Cria e posta uma nova compra com os mesmos valores, com data de hoje"
                      >
                        {rebuyingGuid === invoice.guid ? "..." : "Recomprar hoje"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : null}
            {!loading && invoices.length === 0 ? (
              <tr>
                <td colSpan={10} className="small-muted">
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
