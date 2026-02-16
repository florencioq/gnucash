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

export default function IncomeStatementPage() {
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
    return matrix.rows.filter((row) => {
      if (typeFilter !== "ALL" && row.account_type !== typeFilter) return false;
      if (!q) return true;
      const haystack = `${row.account_name || ""} ${row.account_code || ""} ${row.account_type || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [matrix, search, typeFilter]);

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
        <div className="small-muted mb-3">Selecione um book ativo para visualizar a matriz DRE.</div>
        <div className="alert alert-warning mb-0" role="alert">
          Nenhum book ativo encontrado.
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
            Book ativo: <span className="fw-semibold">{activeBook?.name || activeBook?.id}</span>
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
        <h3 className="h5 mb-3">Matriz DRE (contas x ano-mês)</h3>
        <div className="small-muted mb-3">
          Colunas representam `ano-mês`; linhas representam contas de receita e despesa.
        </div>
        {matrix ? (
          <div className="table-responsive dre-matrix-table-wrap">
            <table className="table table-sm align-middle dre-matrix-table mb-0">
              <thead>
                <tr>
                  <th className="dre-matrix-sticky-col">Conta</th>
                  {matrix.periods.map((period) => (
                    <th key={period} className="text-end">{period}</th>
                  ))}
                  <th className="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="dre-matrix-summary-row">
                  <td className="dre-matrix-sticky-col fw-semibold">Receita Total</td>
                  {matrix.revenue_totals.map((amount, index) => (
                    <td key={`rev:${matrix.periods[index]}`} className="text-end text-success">
                      {formatMoney(amount, matrix.currency_mnemonic || "BRL")}
                    </td>
                  ))}
                  <td className="text-end fw-semibold text-success">
                    {formatMoney(
                      matrix.revenue_totals.reduce((sum, value) => sum + Number(value || 0), 0),
                      matrix.currency_mnemonic || "BRL"
                    )}
                  </td>
                </tr>
                <tr className="dre-matrix-summary-row">
                  <td className="dre-matrix-sticky-col fw-semibold">Despesa Total</td>
                  {matrix.expense_totals.map((amount, index) => (
                    <td key={`exp:${matrix.periods[index]}`} className="text-end text-danger">
                      {formatMoney(amount, matrix.currency_mnemonic || "BRL")}
                    </td>
                  ))}
                  <td className="text-end fw-semibold text-danger">
                    {formatMoney(
                      matrix.expense_totals.reduce((sum, value) => sum + Number(value || 0), 0),
                      matrix.currency_mnemonic || "BRL"
                    )}
                  </td>
                </tr>
                <tr className="dre-matrix-summary-row">
                  <td className="dre-matrix-sticky-col fw-semibold">Lucro Líquido</td>
                  {matrix.net_income_totals.map((amount, index) => (
                    <td
                      key={`net:${matrix.periods[index]}`}
                      className={`text-end ${Number(amount || 0) >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {formatMoney(amount, matrix.currency_mnemonic || "BRL")}
                    </td>
                  ))}
                  <td className="text-end fw-semibold">
                    {formatMoney(
                      matrix.net_income_totals.reduce((sum, value) => sum + Number(value || 0), 0),
                      matrix.currency_mnemonic || "BRL"
                    )}
                  </td>
                </tr>
                {filteredMatrixRows.map((row) => (
                  <tr key={row.account_id}>
                    <td className="dre-matrix-sticky-col">
                      <div className="fw-semibold">{row.account_name}</div>
                      <div className="small-muted">
                        {row.account_type} {row.account_code ? `- ${row.account_code}` : ""}
                      </div>
                    </td>
                    {row.amounts.map((amount, index) => (
                      <td key={`${row.account_id}:${matrix.periods[index]}`} className="text-end">
                        {formatMoney(amount, matrix.currency_mnemonic || "BRL")}
                      </td>
                    ))}
                    <td className="text-end fw-semibold">
                      {formatMoney(row.total_amount, matrix.currency_mnemonic || "BRL")}
                    </td>
                  </tr>
                ))}
                {filteredMatrixRows.length === 0 ? (
                  <tr>
                    <td colSpan={matrix.periods.length + 2} className="small-muted">
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
