import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const REPORT_STATE_KEY = "gnucash.transfers-between-accounts-state.v1";

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
    const filteredIds = filtered.map((a) => a.id);
    const allSelected = filteredIds.every((id) => selectedSet.has(id));
    if (allSelected) {
      onChange(selected.filter((id) => !filteredIds.includes(id)));
    } else {
      const toAdd = filteredIds.filter((id) => !selectedSet.has(id));
      onChange([...selected, ...toAdd]);
    }
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selectedSet.has(a.id));

  const byType = useMemo(() => {
    const map = new Map();
    for (const a of filtered) {
      const t = a.type || "ROOT";
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(a);
    }
    return map;
  }, [filtered]);

  return (
    <div className="mb-3">
      <label className="form-label">{label}</label>
      {selected.length > 0 ? (
        <div className="d-flex flex-wrap gap-1 mb-2">
          {selected.map((id) => {
            const acc = accountById.get(id);
            return (
              <span key={id} className="badge bg-primary d-flex align-items-center gap-1">
                {acc ? acc.name : id}
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  style={{ fontSize: "0.6em" }}
                  aria-label="Remover"
                  onClick={() => removeSelected(id)}
                  disabled={disabled}
                />
              </span>
            );
          })}
        </div>
      ) : null}
      <input
        ref={searchRef}
        type="text"
        className="form-control form-control-sm mb-1"
        placeholder="Buscar conta..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        id={`${selectorId}-search`}
      />
      <div
        className="border rounded"
        style={{ maxHeight: "180px", overflowY: "auto", fontSize: "0.85em" }}
      >
        {filtered.length > 0 ? (
          <>
            <div className="px-2 py-1 border-bottom d-flex justify-content-between align-items-center bg-light">
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none"
                onClick={toggleAllFiltered}
                disabled={disabled}
              >
                {allFilteredSelected ? "Desmarcar todas" : "Selecionar todas"}
              </button>
              <span className="small-muted">{filtered.length} conta(s)</span>
            </div>
            {Array.from(byType.entries()).map(([type, accs]) => (
              <div key={type}>
                <div className="px-2 py-1 small-muted fw-semibold bg-light border-bottom">
                  {TYPE_LABEL[type] || type}
                </div>
                {accs.map((a) => (
                  <label
                    key={a.id}
                    className="d-flex align-items-center gap-2 px-2 py-1 border-bottom"
                    style={{ cursor: disabled ? "default" : "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(a.id)}
                      onChange={() => toggle(a.id)}
                      disabled={disabled}
                    />
                    <span>{a.name}</span>
                    {a.code ? <span className="small-muted">({a.code})</span> : null}
                  </label>
                ))}
              </div>
            ))}
          </>
        ) : (
          <div className="px-2 py-2 small-muted">Nenhuma conta encontrada.</div>
        )}
      </div>
    </div>
  );
}

function splitsTotal(splits) {
  if (!splits || splits.length === 0) return null;
  let sum = 0;
  for (const s of splits) {
    sum += rationalToFloat(s.value_num, s.value_denom);
  }
  return sum;
}

function splitsSummary(splits) {
  if (!splits || splits.length === 0) return "-";
  return splits.map((s) => s.account_name || s.account_id).join(", ");
}

export default function TransfersBetweenAccountsPage({ onOpenInvoicing, onOpenBilling, onOpenLedger }) {
  const persistedState = useMemo(() => loadPersistedState(), []);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();

  const [accounts, setAccounts] = useState([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  const [sourceIds, setSourceIds] = useState(() => persistedState?.sourceIds || []);
  const [destIds, setDestIds] = useState(() => persistedState?.destIds || []);
  const [startDate, setStartDate] = useState(() => persistedState?.startDate || "");
  const [endDate, setEndDate] = useState(() => persistedState?.endDate || "");
  const [sortDirection, setSortDirection] = useState(() => persistedState?.sortDirection || "asc");
  const [page, setPage] = useState(() => Math.max(1, Number(persistedState?.page) || 1));
  const [pageSize, setPageSize] = useState(() => {
    const size = Number(persistedState?.pageSize);
    return PAGE_SIZE_OPTIONS.includes(size) ? size : 25;
  });

  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const canSearch = activeBookId && accountsLoaded && sourceIds.length > 0;

  const totalSrc = useMemo(() => {
    if (items.length === 0) return null;
    let sum = 0;
    for (const item of items) {
      const t = splitsTotal(item.source_splits);
      if (t !== null) sum += t;
    }
    return sum;
  }, [items]);

  const totalDst = useMemo(() => {
    if (items.length === 0) return null;
    let sum = 0;
    for (const item of items) {
      const t = splitsTotal(item.dest_splits);
      if (t !== null) sum += t;
    }
    return sum;
  }, [items]);

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

  const handleSearch = async () => {
    if (!canSearch) return;
    const params = new URLSearchParams({
      book_id: activeBookId,
      sort_direction: sortDirection,
      page: String(page),
      page_size: String(pageSize),
    });
    for (const id of sourceIds) params.append("source_account_id", id);
    for (const id of destIds) params.append("dest_account_id", id);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    setLoading(true);
    const response = await api.get(`/reports/transfers?${params.toString()}`);
    setLoading(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setError(null);
    setHasSearched(true);
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
    loadAccounts(activeBookId);
  }, [activeBookId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      REPORT_STATE_KEY,
      JSON.stringify({ sourceIds, destIds, startDate, endDate, sortDirection, page, pageSize })
    );
  }, [sourceIds, destIds, startDate, endDate, sortDirection, page, pageSize]);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Transferências entre Contas</h2>
          <div className="small-muted">
            Transações que envolvem as contas de origem selecionadas, filtradas opcionalmente por contas de destino.
          </div>
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
          <AccountMultiSelect
            label="Contas de origem"
            selectorId="src"
            accounts={accounts}
            selected={sourceIds}
            onChange={(ids) => { setSourceIds(ids); setPage(1); }}
            disabled={!accountsLoaded}
          />
        </div>
        <div className="col-md-4">
          <AccountMultiSelect
            label="Contas de destino (opcional)"
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
          Selecione as contas de origem e clique em Buscar. A conta de destino é opcional.
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
                  <th>Conta(s) de Origem</th>
                  <th className="text-end">Valor Origem</th>
                  <th>Conta(s) de Destino</th>
                  <th className="text-end">Valor Destino</th>
                  <th>Memo</th>
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="small-muted">
                      Carregando...
                    </td>
                  </tr>
                ) : null}
                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="small-muted">
                      Nenhuma transação encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : null}
                {!loading
                  ? items.map((item) => {
                      const srcSplits = item.source_splits || [];
                      const dstSplits = item.dest_splits || [];
                      const srcTotal = splitsTotal(srcSplits);
                      const dstTotal = splitsTotal(dstSplits);
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
                          <td>{splitsSummary(dstSplits)}</td>
                          <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                            {dstTotal !== null
                              ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(dstTotal))
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
                    <td />
                    <td className="text-end">
                      {totalDst !== null
                        ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(totalDst))
                        : "-"}
                    </td>
                    <td colSpan={2} />
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
