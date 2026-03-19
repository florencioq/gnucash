import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";
import { useToolbar } from "../context/ToolbarContext.jsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const REPORT_STATE_KEY = "gnucash.account-transfers-report-state.v1";

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

function rationalToFloat(num, denom) {
  const d = Number(denom) || 1;
  return Number(num || 0) / d;
}

const TYPE_ORDER = ["ASSET", "LIABILITY", "INCOME", "EXPENSE", "EQUITY", "ROOT"];
const TYPE_LABEL = {
  ASSET: "Ativo",
  LIABILITY: "Passivo",
  INCOME: "Receita",
  EXPENSE: "Despesa",
  EQUITY: "Patrimônio",
  ROOT: "Raiz",
};

function sortedAccounts(accounts) {
  return accounts.slice().sort((a, b) => {
    const ta = TYPE_ORDER.indexOf(a.type || "ROOT");
    const tb = TYPE_ORDER.indexOf(b.type || "ROOT");
    if (ta !== tb) return ta - tb;
    return (a.name || "").localeCompare(b.name || "", "pt-BR");
  });
}

function AccountMultiSelect({ accounts, selected, onChange, disabled, label, selectorId }) {
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? accounts.filter(
          (a) =>
            (a.name || "").toLowerCase().includes(q) ||
            (a.code || "").toLowerCase().includes(q)
        )
      : accounts;
    return sortedAccounts(list);
  }, [accounts, query]);

  const toggle = (id) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const removeSelected = (id) => onChange(selected.filter((s) => s !== id));

  const toggleAllFiltered = () => {
    const filteredIds = new Set(filtered.map((a) => a.id));
    const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selectedSet.has(a.id));
    if (allFilteredSelected) {
      onChange(selected.filter((id) => !filteredIds.has(id)));
    } else {
      const next = new Set(selected);
      for (const a of filtered) next.add(a.id);
      onChange([...next]);
    }
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selectedSet.has(a.id));

  let lastType = null;

  return (
    <div>
      <label className="form-label mb-1">{label}</label>

      {selected.length > 0 ? (
        <div className="d-flex flex-wrap gap-1 mb-2">
          {selected.map((id) => {
            const acc = accountById.get(id);
            return (
              <span key={id} className="badge bg-primary d-flex align-items-center gap-1" style={{ fontWeight: 400 }}>
                {acc ? acc.name : id}
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  style={{ fontSize: "0.6rem" }}
                  aria-label="Remover"
                  onClick={() => removeSelected(id)}
                  disabled={disabled}
                />
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="input-group input-group-sm mb-1">
        <input
          ref={searchRef}
          type="text"
          className="form-control"
          placeholder="Buscar por nome ou código..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled || accounts.length === 0}
        />
        {query ? (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => { setQuery(""); searchRef.current?.focus(); }}
            tabIndex={-1}
          >
            ✕
          </button>
        ) : null}
      </div>

      <div className="d-flex align-items-center justify-content-between mb-1">
        <span className="small-muted">
          {filtered.length} conta(s){query ? " encontrada(s)" : ""}
        </span>
        <button
          type="button"
          className="btn btn-link btn-sm p-0"
          onClick={toggleAllFiltered}
          disabled={disabled || filtered.length === 0}
        >
          {allFilteredSelected ? "Desmarcar" : "Selecionar"}{query ? " encontradas" : " todas"}
        </button>
      </div>

      <div
        className="border rounded"
        style={{ maxHeight: "200px", overflowY: "auto", background: "#fff" }}
      >
        {accounts.length === 0 ? (
          <div className="p-2 small-muted">Nenhuma conta disponível</div>
        ) : filtered.length === 0 ? (
          <div className="p-2 small-muted">Nenhuma conta corresponde à busca.</div>
        ) : (
          <div className="p-1">
            {filtered.map((acc) => {
              const showHeader = acc.type !== lastType;
              lastType = acc.type;
              return (
                <React.Fragment key={acc.id}>
                  {showHeader ? (
                    <div className="px-1 py-1 small-muted fw-semibold" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {TYPE_LABEL[acc.type] || acc.type}
                    </div>
                  ) : null}
                  <div className="form-check form-check-sm px-1">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`${selectorId}-${acc.id}`}
                      checked={selectedSet.has(acc.id)}
                      onChange={() => toggle(acc.id)}
                      disabled={disabled}
                    />
                    <label className="form-check-label small w-100" htmlFor={`${selectorId}-${acc.id}`} style={{ cursor: "pointer" }}>
                      {acc.name}
                      {acc.code ? <span className="text-muted ms-1">({acc.code})</span> : null}
                    </label>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function splitsSummary(splits) {
  if (!splits || splits.length === 0) return "-";
  if (splits.length === 1) return splits[0].account_name || "-";
  const names = splits.map((s) => s.account_name).filter(Boolean);
  return names.join(", ");
}

function splitsTotal(splits) {
  if (!splits || splits.length === 0) return null;
  let num = 0;
  let denom = 1;
  for (const s of splits) {
    const v = rationalToFloat(s.value_num, s.value_denom);
    num += v * denom;
  }
  return num / denom;
}

export default function AccountTransfersReportPage({ onOpenInvoicing = null, onOpenBilling = null, onOpenLedger = null, isActive = false }) {
  const persistedState = useMemo(() => loadPersistedState(), []);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();

  const [accounts, setAccounts] = useState([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [sourceIds, setSourceIds] = useState(() => persistedState?.sourceIds || []);
  const [destIds, setDestIds] = useState(() => persistedState?.destIds || []);
  const [startDate, setStartDate] = useState(() => String(persistedState?.startDate || ""));
  const [endDate, setEndDate] = useState(() => String(persistedState?.endDate || ""));
  const [sortDirection, setSortDirection] = useState(() => String(persistedState?.sortDirection || "asc"));
  const [page, setPage] = useState(() => Math.max(1, Number(persistedState?.page) || 1));
  const [pageSize, setPageSize] = useState(() => {
    const size = Number(persistedState?.pageSize);
    return PAGE_SIZE_OPTIONS.includes(size) ? size : 25;
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadAccounts = async (bookId) => {
    setAccountsLoaded(false);
    const response = await api.get(`/accounts?book_id=${bookId}`);
    if (!response.ok) {
      setError(response.error);
      setAccountsLoaded(true);
      return;
    }
    const all = (response.data || []).filter((a) => a.type !== "ROOT" && !a.is_placeholder);
    setAccounts(all);
    setAccountsLoaded(true);
  };

  const loadReport = async (bookId) => {
    if (sourceIds.length === 0 || destIds.length === 0) return;

    const params = new URLSearchParams({
      book_id: bookId,
      sort_direction: sortDirection,
      page: String(page),
      page_size: String(pageSize),
    });
    for (const id of sourceIds) params.append("source_account_id", id);
    for (const id of destIds) params.append("dest_account_id", id);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    setLoading(true);
    setHasSearched(true);
    const response = await api.get(`/reports/account-transfers?${params.toString()}`);
    setLoading(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setError(null);
    setItems(response.data.items || []);
    setPage(response.data.page || 1);
    setPageSize(response.data.page_size || pageSize);
    setTotalItems(response.data.total_items || 0);
    setTotalPages(response.data.total_pages || 1);
  };

  useEffect(() => {
    if (!activeBookId) return;
    setAccounts([]);
    setAccountsLoaded(false);
    setItems([]);
    setHasSearched(false);
    loadAccounts(activeBookId);
  }, [activeBookId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      REPORT_STATE_KEY,
      JSON.stringify({ sourceIds, destIds, startDate, endDate, sortDirection, page, pageSize })
    );
  }, [sourceIds, destIds, startDate, endDate, sortDirection, page, pageSize]);

  const handleSearch = () => {
    setPage(1);
    if (!activeBookId || sourceIds.length === 0 || destIds.length === 0) return;
    loadReport(activeBookId);
  };

  useEffect(() => {
    if (!activeBookId || !hasSearched) return;
    loadReport(activeBookId);
  }, [page, pageSize, sortDirection]);

  const canSearch = activeBookId && accountsLoaded && sourceIds.length > 0 && destIds.length > 0;

  const totalSrc = useMemo(() => {
    if (items.length === 0) return null;
    let sum = 0;
    for (const item of items) {
      const t = splitsTotal(item.source_splits);
      if (t !== null) sum += t;
    }
    return sum;
  }, [items]);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });

    const bookName = activeBook?.name || activeBook?.id || "";
    const srcNames = sourceIds.map((id) => accountById.get(id)?.name || id).join(", ") || "-";
    const dstNames = destIds.map((id) => accountById.get(id)?.name || id).join(", ") || "Todas";
    const period = [startDate, endDate].filter(Boolean).join(" a ") || "Todos os períodos";

    doc.setFontSize(14);
    doc.text("Pagamentos por Conta", 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Livro: ${bookName}`, 14, 23);
    doc.text(`Conta devedora: ${srcNames}`, 14, 28);
    doc.text(`Conta de pagamento: ${dstNames}`, 14, 33);
    doc.text(`Período: ${period}`, 14, 38);
    doc.text(`Total de registros: ${totalItems}`, 14, 43);

    const fmt = (num) =>
      new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(num));

    const rows = items.map((item) => {
      const srcSplits = item.source_splits || [];
      const srcTotal = splitsTotal(srcSplits);
      const ownerType = item.linked_owner_type || "";
      const docLabel = ownerType === "CUSTOMER"
        ? `Fatura ${item.linked_invoice_id || ""}`.trim()
        : ownerType === "VENDOR"
        ? `Compra ${item.linked_invoice_id || ""}`.trim()
        : "-";
      const memos = srcSplits.map((s) => s.memo).filter(Boolean).join("; ");
      return [
        formatDateDisplay(item.post_date),
        item.description || "-",
        splitsSummary(srcSplits),
        srcTotal !== null ? fmt(srcTotal) : "-",
        docLabel,
        memos || "-",
      ];
    });

    // Page total row
    if (totalSrc !== null) {
      rows.push(["", "Total (página)", "", fmt(totalSrc), "", ""]);
    }

    autoTable(doc, {
      startY: 48,
      head: [["Data", "Descrição", "Conta de pagamento", "Valor pago", "Compra / Fatura", "Memo"]],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [52, 73, 94] },
      columnStyles: { 3: { halign: "right" } },
      didParseCell: (data) => {
        if (data.row.index === rows.length - 1 && totalSrc !== null) {
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    doc.save(`pagamentos-por-conta-${dateStr}.pdf`);
  };

  const { registerToolbar } = useToolbar();

  useEffect(() => {
    if (!isActive) return;
    registerToolbar(
      <div className="d-flex align-items-center justify-content-between w-100">
        <div>
          <h2 className="mb-1">Pagamentos por Conta</h2>
          <div className="small-muted">
            Pagamentos de compras/faturas cujo lançamento de postagem débita a conta de despesa selecionada, filtrados pela conta de pagamento.
          </div>
        </div>
        {hasSearched && items.length > 0 ? (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={downloadPdf}
            title="Baixar PDF da página atual"
          >
            ⬇ PDF
          </button>
        ) : null}
      </div>
    );
    return () => registerToolbar(null);
  }, [isActive, registerToolbar, hasSearched, items.length, downloadPdf]);

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
          <AccountMultiSelect
            label="Conta devedora na postagem (despesa)"
            selectorId="src"
            accounts={accounts}
            selected={sourceIds}
            onChange={(ids) => { setSourceIds(ids); setPage(1); }}
            disabled={!accountsLoaded}
          />
        </div>
        <div className="col-md-4">
          <AccountMultiSelect
            label="Conta de pagamento"
            selectorId="dst"
            accounts={accounts}
            selected={destIds}
            onChange={(ids) => { setDestIds(ids); setPage(1); }}
            disabled={!accountsLoaded}
          />
        </div>
        <div className="col-md-4">
          <div className="mb-3">
            <label className="form-label">Data inicial</label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              disabled={!activeBookId}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Data final</label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              disabled={!activeBookId}
            />
          </div>
          <div className="mb-2">
            <label className="form-label">Ordenação</label>
            <select
              className="form-select"
              value={sortDirection}
              onChange={(e) => { setSortDirection(e.target.value); setPage(1); }}
              disabled={!activeBookId}
            >
              <option value="asc">Data ↑ (mais antigas primeiro)</option>
              <option value="desc">Data ↓ (mais recentes primeiro)</option>
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary w-100"
            onClick={handleSearch}
            disabled={!canSearch || loading}
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
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

      {!hasSearched && !loading ? (
        <div className="small-muted">
          Selecione a conta devedora (despesa) e a conta de pagamento, e clique em Buscar.
        </div>
      ) : null}

      {hasSearched ? (
        <>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Conta de pagamento</th>
                  <th className="text-end">Valor pago</th>
                  <th>Compra / Fatura</th>
                  <th>Memo</th>
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="small-muted">
                      Carregando...
                    </td>
                  </tr>
                ) : null}
                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="small-muted">
                      Nenhum pagamento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : null}
                {!loading
                  ? items.map((item) => {
                      const srcSplits = item.source_splits || [];
                      const dstSplits = item.dest_splits || [];
                      const srcTotal = splitsTotal(srcSplits);
                      const memos = [...srcSplits, ...dstSplits]
                        .map((s) => s.memo)
                        .filter(Boolean)
                        .join("; ");

                      const ownerType = item.linked_owner_type || "";
                      const isInvoice = ownerType === "CUSTOMER";
                      const isBill = ownerType === "VENDOR";
                      const hasDoc = Boolean(item.linked_invoice_guid);

                      const openDoc = () => {
                        if (isInvoice && typeof onOpenInvoicing === "function") {
                          onOpenInvoicing({ invoiceGuid: item.linked_invoice_guid, invoiceId: item.linked_invoice_id || "" });
                        } else if (isBill && typeof onOpenBilling === "function") {
                          onOpenBilling({ billGuid: item.linked_invoice_guid, billId: item.linked_invoice_id || "" });
                        }
                      };

                      const openLedger = () => {
                        if (typeof onOpenLedger === "function") {
                          const accountId = srcSplits[0]?.account_id || dstSplits[0]?.account_id || "";
                          onOpenLedger({ accountId });
                        }
                      };

                      return (
                        <tr key={item.tx_guid}>
                          <td style={{ whiteSpace: "nowrap" }}>{formatDateDisplay(item.post_date)}</td>
                          <td>{item.description || "-"}</td>
                          <td>{splitsSummary(srcSplits)}</td>
                          <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                            {srcTotal !== null
                              ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(srcTotal))
                              : "-"}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {hasDoc
                              ? `${isInvoice ? "Fatura" : "Compra"} ${item.linked_invoice_id || ""}`.trim()
                              : "-"}
                          </td>
                          <td className="small-muted">{memos || "-"}</td>
                          <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                            {hasDoc ? (
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={openDoc}
                                title={isInvoice ? `Abrir fatura ${item.linked_invoice_id || ""}` : `Abrir compra ${item.linked_invoice_id || ""}`}
                              >
                                {isInvoice ? "Abrir fatura" : "Abrir compra"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={openLedger}
                                disabled={typeof onOpenLedger !== "function"}
                                title="Ver no Razão"
                              >
                                Razão
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  : null}
              </tbody>
              {!loading && items.length > 0 ? (
                <tfoot>
                  <tr className="fw-semibold">
                    <td colSpan={3} className="text-end">Total (página)</td>
                    <td className="text-end">
                      {totalSrc !== null
                        ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(totalSrc))
                        : "-"}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
            <div className="small-muted">
              Mostrando {items.length} de {totalItems} transações
            </div>
            <div className="d-flex align-items-center gap-2">
              <label className="form-label mb-0 small-muted">Itens por página</label>
              <select
                className="form-select form-select-sm"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value) || 25); setPage(1); }}
                disabled={!activeBookId}
                style={{ width: "96px" }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
        </>
      ) : null}
    </div>
  );
}
