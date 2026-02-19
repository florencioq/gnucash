import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";

function currentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function shiftMonth(ym, delta) {
  const [yearRaw, monthRaw] = String(ym || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) return ym;
  const absolute = year * 12 + (month - 1) + delta;
  const shiftedYear = Math.floor(absolute / 12);
  const shiftedMonth = String((absolute % 12) + 1).padStart(2, "0");
  return `${shiftedYear}-${shiftedMonth}`;
}

function formatMoney(value, currencyMnemonic) {
  const numeric = Number(value || 0);
  if (currencyMnemonic && currencyMnemonic.length === 3) {
    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: currencyMnemonic
      }).format(numeric);
    } catch (_error) {
      // Fall back to decimal formatting.
    }
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numeric);
}

function parseYearMonth(ym) {
  const [yearRaw, monthRaw] = String(ym || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month || month < 1 || month > 12) return null;
  return { year, month };
}

function monthStartDate(ym) {
  const parsed = parseYearMonth(ym);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
}

function monthEndDate(ym) {
  const parsed = parseYearMonth(ym);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.year, parsed.month, 0));
}

function formatDateBR(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function splitAccountPath(accountPath) {
  return String(accountPath || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export default function IncomeStatementPage({ onOpenLedger = () => {} }) {
  const defaultMonth = currentMonth();
  const { activeBook, activeBookId, activeBookError } = useActiveBook();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [matrix, setMatrix] = useState(null);
  const [error, setError] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixStartMonth, setMatrixStartMonth] = useState(shiftMonth(defaultMonth, -5));
  const [matrixEndMonth, setMatrixEndMonth] = useState(defaultMonth);

  const loadMatrix = async () => {
    if (!activeBookId || !matrixStartMonth || !matrixEndMonth) return;
    if (matrixStartMonth > matrixEndMonth) {
      setError({
        code: "INVALID_MONTH_RANGE",
        message: "Período inicial deve ser menor ou igual ao período final."
      });
      return;
    }
    setMatrixLoading(true);
    const res = await api.get(
      `/reports/income-statement/matrix?book_id=${encodeURIComponent(activeBookId)}&start_month=${encodeURIComponent(matrixStartMonth)}&end_month=${encodeURIComponent(matrixEndMonth)}`
    );
    if (!res.ok) {
      setError(res.error);
      setMatrix(null);
      setMatrixLoading(false);
      return;
    }
    setError(null);
    setMatrix(res.data);
    setMatrixLoading(false);
  };

  useEffect(() => {
    if (!activeBookId) return;
    loadMatrix();
  }, [activeBookId, matrixStartMonth, matrixEndMonth]);

  const filteredMatrixRows = useMemo(() => {
    if (!matrix?.rows) return [];
    const q = search.trim().toLowerCase();
    const filtered = matrix.rows.filter((row) => {
      if (typeFilter !== "ALL" && row.account_type !== typeFilter) return false;
      if (!q) return true;
      const haystack = `${row.account_name || ""} ${row.account_code || ""} ${row.account_type || ""}`.toLowerCase();
      return haystack.includes(q);
    });
    const typeOrder = {
      INCOME: 0,
      EXPENSE: 1
    };
    return filtered
      .slice()
      .sort((a, b) => {
        const byType = (typeOrder[a.account_type] ?? 99) - (typeOrder[b.account_type] ?? 99);
        if (byType !== 0) return byType;
        return String(a.account_name || "").localeCompare(String(b.account_name || ""), "pt-BR", {
          sensitivity: "base"
        });
      })
      .map((row) => {
        const pathParts = splitAccountPath(row.account_name);
        return {
          ...row,
          displayName: pathParts[pathParts.length - 1] || row.account_name,
          depth: Math.max(pathParts.length - 1, 0)
        };
      });
  }, [matrix, search, typeFilter]);

  const reversedPeriodIndexes = useMemo(() => {
    if (!matrix?.periods) return [];
    return matrix.periods.map((_period, index) => index).reverse();
  }, [matrix]);

  const incomeRows = useMemo(
    () => filteredMatrixRows.filter((row) => row.account_type === "INCOME"),
    [filteredMatrixRows]
  );

  const expenseRows = useMemo(
    () => filteredMatrixRows.filter((row) => row.account_type === "EXPENSE"),
    [filteredMatrixRows]
  );

  const rangeLabel = useMemo(() => {
    if (!matrix?.periods?.length) return "";
    const start = formatDateBR(monthStartDate(matrix.periods[0]));
    const end = formatDateBR(monthEndDate(matrix.periods[matrix.periods.length - 1]));
    if (!start || !end) return "";
    return `${start} até ${end}`;
  }, [matrix]);

  const netIncomeGrandTotal = useMemo(() => {
    if (!matrix?.net_income_totals) return 0;
    return matrix.net_income_totals.reduce((sum, value) => sum + Number(value || 0), 0);
  }, [matrix]);

  const renderSection = (label, rows, totals, tone) => (
    <>
      <tr className="dre-classic-section-row">
        <td className="dre-classic-sticky-col fw-bold">{label}</td>
        {reversedPeriodIndexes.map((index) => (
          <td key={`${label}:section:${index}`} />
        ))}
        <td />
      </tr>
      {rows.map((row) => (
        <tr key={`${label}:${row.account_id}`}>
          <td className="dre-classic-sticky-col">
            <button
              type="button"
              className="dre-classic-name-link"
              style={{ paddingLeft: `${0.6 + row.depth * 1.2}rem` }}
              onClick={() => openLedgerForAccount(row.account_id)}
              title="Abrir no Razão desta conta"
            >
              {row.displayName}
            </button>
          </td>
          {reversedPeriodIndexes.map((index) => (
            <td key={`${label}:${row.account_id}:${matrix.periods[index]}`} className="text-end">
              <button
                type="button"
                className="dre-classic-value-link"
                onClick={() => openLedgerForAccount(row.account_id)}
                title="Abrir no Razão desta conta"
              >
                {formatMoney(row.amounts[index], matrix.currency_mnemonic || "BRL")}
              </button>
            </td>
          ))}
          <td className="text-end fw-semibold">
            <button
              type="button"
              className="dre-classic-value-link fw-semibold"
              onClick={() => openLedgerForAccount(row.account_id)}
              title="Abrir no Razão desta conta"
            >
              {formatMoney(row.total_amount, matrix.currency_mnemonic || "BRL")}
            </button>
          </td>
        </tr>
      ))}
      <tr className={`dre-classic-total-row ${tone}`}>
        <td className="dre-classic-sticky-col fw-bold">Total para {label}</td>
        {reversedPeriodIndexes.map((index) => (
          <td key={`${label}:total:${index}`} className="text-end fw-bold">
            {formatMoney(totals[index], matrix.currency_mnemonic || "BRL")}
          </td>
        ))}
        <td className="text-end fw-bold">
          {formatMoney(
            totals.reduce((sum, value) => sum + Number(value || 0), 0),
            matrix.currency_mnemonic || "BRL"
          )}
        </td>
      </tr>
    </>
  );

  const openLedgerForAccount = (accountId) => {
    if (!accountId) return;
    onOpenLedger({ accountId });
  };

  if (activeBookError) {
    return (
      <div className="alert alert-danger mb-0" role="alert">
        {activeBookError.code}: {activeBookError.message}
      </div>
    );
  }

  if (!activeBookId) {
    return (
      <div>
        <h2 className="mb-1">DRE Mensal</h2>
        <div className="small-muted mb-3">Selecione um livro ativo para visualizar a matriz DRE.</div>
        <div className="alert alert-warning mb-0" role="alert">
          Nenhum livro ativo encontrado.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h2 className="mb-1">DRE Mensal</h2>
          <div className="small-muted">
            Livro ativo: <span className="fw-semibold">{activeBook?.name || activeBook?.id}</span>
          </div>
        </div>
        <button className="btn btn-outline-secondary" type="button" onClick={loadMatrix} disabled={matrixLoading}>
          {matrixLoading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <div className="row g-2 align-items-end mb-3">
        <div className="col-md-3">
          <label className="form-label">Período inicial</label>
          <input
            type="month"
            className="form-control"
            value={matrixStartMonth}
            onChange={(event) => setMatrixStartMonth(event.target.value)}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Período final</label>
          <input
            type="month"
            className="form-control"
            value={matrixEndMonth}
            onChange={(event) => setMatrixEndMonth(event.target.value)}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Buscar conta</label>
          <input
            className="form-control"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome ou código"
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Tipo de conta</label>
          <select
            className="form-select"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="ALL">Todas</option>
            <option value="INCOME">Receitas</option>
            <option value="EXPENSE">Despesas</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error.code}: {error.message}
        </div>
      ) : null}

      <div className="dre-panel mb-0">
        <h3 className="h4 mb-2">
          Declaração de renda (várias colunas) {rangeLabel || `${matrixStartMonth} até ${matrixEndMonth}`}
        </h3>
        {matrix ? (
          <div className="table-responsive dre-classic-table-wrap">
            <table className="table table-sm align-middle dre-classic-table mb-0">
              <thead>
                <tr>
                  <th className="dre-classic-sticky-col">Período</th>
                  {reversedPeriodIndexes.map((index) => (
                    <th key={matrix.periods[index]} className="text-center">
                      <div>{formatDateBR(monthStartDate(matrix.periods[index]))}</div>
                      <div>para {formatDateBR(monthEndDate(matrix.periods[index]))}</div>
                    </th>
                  ))}
                  <th className="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="dre-classic-total-row net">
                  <td className="dre-classic-sticky-col fw-bold">Resultado Líquido</td>
                  {reversedPeriodIndexes.map((index) => (
                    <td
                      key={`net:${matrix.periods[index]}`}
                      className={`text-end fw-bold ${Number(matrix.net_income_totals[index] || 0) >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {formatMoney(matrix.net_income_totals[index], matrix.currency_mnemonic || "BRL")}
                    </td>
                  ))}
                  <td className={`text-end fw-bold ${netIncomeGrandTotal >= 0 ? "text-success" : "text-danger"}`}>
                    {formatMoney(netIncomeGrandTotal, matrix.currency_mnemonic || "BRL")}
                  </td>
                </tr>
                {typeFilter !== "EXPENSE" ? renderSection("Receita", incomeRows, matrix.revenue_totals, "income") : null}
                {typeFilter !== "INCOME" ? renderSection("Despesa", expenseRows, matrix.expense_totals, "expense") : null}
                {filteredMatrixRows.length === 0 ? (
                  <tr>
                    <td colSpan={matrix.periods.length + 2} className="small-muted text-center py-3">
                      Nenhuma linha para os filtros aplicados no período selecionado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="small-muted">
            {matrixLoading ? "Carregando matriz..." : "Sem dados de matriz para exibir."}
          </div>
        )}
      </div>
    </div>
  );
}
