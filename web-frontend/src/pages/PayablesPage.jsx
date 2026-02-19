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

function formatCurrencyValue(value, mnemonic = "BRL") {
  const rawMnemonic = String(mnemonic || "").trim();
  const currencyCode = rawMnemonic.toUpperCase();
  try {
    if (/^[A-Z]{3}$/.test(currencyCode)) {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: currencyCode
      }).format(value);
    }
  } catch {
    // Fall through to text prefix formatting below.
  }

  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return rawMnemonic ? `${rawMnemonic} ${formatted}` : formatted;
}

function paymentStateLabel(state) {
  if (state === "PAID") return "Paga";
  if (state === "PARTIAL") return "Parcial";
  return "Não paga";
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const PAYABLES_STATE_KEY = "gnucash.payables-state.v1";

function loadPayablesState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PAYABLES_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function PayablesPage({
  onOpenBilling = null,
  onOpenInvoicing = null,
  onCreateBilling = null
}) {
  const persistedState = useMemo(() => loadPayablesState(), []);
  const [commodities, setCommodities] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoaded, setVendorsLoaded] = useState(false);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();

  const [vendorFilterGuid, setVendorFilterGuid] = useState(() => String(persistedState?.vendorFilterGuid || ""));
  const [postedStartDate, setPostedStartDate] = useState(() => String(persistedState?.postedStartDate || ""));
  const [postedEndDate, setPostedEndDate] = useState(() => String(persistedState?.postedEndDate || ""));
  const [sortKey, setSortKey] = useState(() => String(persistedState?.sortKey || "open"));
  const [sortDirection, setSortDirection] = useState(() => String(persistedState?.sortDirection || "desc"));
  const [page, setPage] = useState(() => Math.max(1, Number(persistedState?.page) || 1));
  const [pageSize, setPageSize] = useState(() => {
    const size = Number(persistedState?.pageSize);
    return PAGE_SIZE_OPTIONS.includes(size) ? size : 25;
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [openAmountGrandTotal, setOpenAmountGrandTotal] = useState(0);
  const [loadingOpenAmountGrandTotal, setLoadingOpenAmountGrandTotal] = useState(false);

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

  const loadBills = async (bookId) => {
    const params = new URLSearchParams({
      book_id: bookId,
      posted_filter: "POSTED",
      payment_filter: "OPEN",
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
    setBills(response.data.items || []);
    setPage(response.data.page || 1);
    setPageSize(response.data.page_size || pageSize);
    setTotalItems(response.data.total_items || 0);
    setTotalPages(response.data.total_pages || 1);
  };

  const loadOpenAmountGrandTotal = async (bookId) => {
    const baseParams = {
      book_id: bookId,
      posted_filter: "POSTED",
      payment_filter: "OPEN",
      sort_key: "id",
      sort_direction: "asc",
      page_size: "200"
    };

    let currentPage = 1;
    let totalPagesAll = 1;
    let aggregate = 0;

    while (currentPage <= totalPagesAll) {
      const params = new URLSearchParams({ ...baseParams, page: String(currentPage) });
      if (vendorFilterGuid) params.set("vendor_guid", vendorFilterGuid);
      if (postedStartDate) params.set("posted_start_date", postedStartDate);
      if (postedEndDate) params.set("posted_end_date", postedEndDate);

      const response = await api.get(`/bills/list?${params.toString()}`);
      if (!response.ok) {
        setError(response.error);
        return null;
      }

      const items = response.data.items || [];
      aggregate += items.reduce(
        (sum, bill) => sum + Math.abs(rationalToNumber(bill.open_amount_num, bill.open_amount_denom)),
        0
      );
      totalPagesAll = Number(response.data.total_pages) || 1;
      currentPage += 1;
    }

    return aggregate;
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
    loadBills(activeBookId);
  }, [activeBookId, refreshToken, vendorFilterGuid, postedStartDate, postedEndDate, sortKey, sortDirection, page, pageSize]);

  useEffect(() => {
    if (!activeBookId) {
      setOpenAmountGrandTotal(0);
      setLoadingOpenAmountGrandTotal(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoadingOpenAmountGrandTotal(true);
      const total = await loadOpenAmountGrandTotal(activeBookId);
      if (cancelled) return;
      if (total !== null) {
        setOpenAmountGrandTotal(total);
      }
      setLoadingOpenAmountGrandTotal(false);
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [activeBookId, refreshToken, vendorFilterGuid, postedStartDate, postedEndDate]);

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
      postedStartDate,
      postedEndDate,
      sortKey,
      sortDirection,
      page,
      pageSize
    };
    window.sessionStorage.setItem(PAYABLES_STATE_KEY, JSON.stringify(state));
  }, [vendorFilterGuid, postedStartDate, postedEndDate, sortKey, sortDirection, page, pageSize]);

  const openBill = (bill) => {
    if (!bill?.guid) return;
    if (typeof onOpenBilling === "function") {
      onOpenBilling({ billGuid: bill.guid, billId: bill.id || "" });
      return;
    }
    if (typeof onOpenInvoicing === "function") {
      onOpenInvoicing({ invoiceGuid: bill.guid, invoiceId: bill.id || "" });
    }
  };

  const totalCurrencyMnemonic = useMemo(() => {
    if (bills.length === 0) return "BRL";
    const first = bills[0];
    return commoditiesById.get(first.currency_guid)?.mnemonic || "BRL";
  }, [bills, commoditiesById]);
  const refreshing = loading || loadingOpenAmountGrandTotal || !vendorsLoaded;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Contas a Pagar</h2>
          <div className="small-muted">Compras postadas e em aberto com acesso direto para edição.</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setRefreshToken((current) => current + 1)}
            disabled={!activeBookId || refreshing}
          >
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
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
      </div>

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
        <div className="col-md-2">
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
        <div className="col-md-2">
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
        <div className="col-md-4 d-flex align-items-end">
          <div>
            <div>
              Total em aberto (todos os resultados):{" "}
              {loadingOpenAmountGrandTotal
                ? "Calculando..."
                : formatCurrencyValue(openAmountGrandTotal, totalCurrencyMnemonic)}
            </div>
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
                <td colSpan={8} className="small-muted">
                  Carregando contas a pagar...
                </td>
              </tr>
            ) : null}
            {!loading ? bills.map((bill) => {
              const vendorName = bill.vendor_name || vendorsById.get(bill.vendor_guid)?.name;
              const paymentState = bill.payment_status || "UNPAID";
              const mnemonic = commoditiesById.get(bill.currency_guid)?.mnemonic || "";

              return (
                <tr key={bill.guid}>
                  <td>
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 align-baseline"
                      onClick={() => openBill(bill)}
                    >
                      {bill.id || "-"}
                    </button>
                  </td>
                  <td>{vendorName || "fornecedor não encontrado"}</td>
                  <td>{formatDateDisplay(bill.date_opened)}</td>
                  <td>{formatDateDisplay(bill.date_posted)}</td>
                  <td>{paymentStateLabel(paymentState)}</td>
                  <td className="text-end">{formatMoney(bill.total_num, bill.total_denom, mnemonic)}</td>
                  <td className="text-end">{formatMoney(bill.open_amount_num, bill.open_amount_denom, mnemonic)}</td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => openBill(bill)}
                      disabled={!bill.guid || (typeof onOpenBilling !== "function" && typeof onOpenInvoicing !== "function")}
                    >
                      Abrir compra
                    </button>
                  </td>
                </tr>
              );
            }) : null}
            {!loading && bills.length === 0 ? (
              <tr>
                <td colSpan={8} className="small-muted">
                  Nenhuma compra em aberto para os filtros selecionados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
        <div className="small-muted">Mostrando {bills.length} de {totalItems} compras em aberto</div>
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
