import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";

function currentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

function formatPercent(value) {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "-";
  const signal = numeric > 0 ? "+" : "";
  return `${signal}${numeric.toFixed(2)}%`;
}

export default function IncomeStatementPage() {
  const { activeBook, activeBookId, activeBookError } = useActiveBook();
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedAccountId, setExpandedAccountId] = useState("");
  const [entriesByAccount, setEntriesByAccount] = useState({});
  const [entriesLoadingByAccount, setEntriesLoadingByAccount] = useState({});

  const loadReport = async () => {
    if (!activeBookId || !month) return;
    setLoading(true);
    const res = await api.get(
      `/reports/income-statement?book_id=${encodeURIComponent(activeBookId)}&month=${encodeURIComponent(month)}`
    );
    if (!res.ok) {
      setError(res.error);
      setReport(null);
      setLoading(false);
      return;
    }
    setError(null);
    setReport(res.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!activeBookId) return;
    loadReport();
  }, [activeBookId, month]);

  useEffect(() => {
    setExpandedAccountId("");
    setEntriesByAccount({});
    setEntriesLoadingByAccount({});
  }, [activeBookId, month]);

  const filteredLines = useMemo(() => {
    if (!report?.lines) return [];
    const q = search.trim().toLowerCase();
    return report.lines.filter((line) => {
      if (typeFilter !== "ALL" && line.account_type !== typeFilter) return false;
      if (!q) return true;
      const haystack = `${line.account_name || ""} ${line.account_code || ""} ${line.account_type || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [report, search, typeFilter]);

  const waterfallMax = useMemo(() => {
    if (!report?.waterfall || report.waterfall.length === 0) return 1;
    return Math.max(...report.waterfall.map((item) => Math.abs(Number(item.amount || 0))), 1);
  }, [report]);

  const seriesNetMax = useMemo(() => {
    if (!report?.series || report.series.length === 0) return 1;
    return Math.max(...report.series.map((point) => Math.abs(Number(point.net_income || 0))), 1);
  }, [report]);

  const toggleAccountEntries = async (accountId) => {
    if (!activeBookId || !month) return;
    if (expandedAccountId === accountId) {
      setExpandedAccountId("");
      return;
    }

    setExpandedAccountId(accountId);
    if (entriesByAccount[accountId]) return;

    setEntriesLoadingByAccount((prev) => ({ ...prev, [accountId]: true }));
    const res = await api.get(
      `/reports/income-statement/accounts/${accountId}/entries?book_id=${encodeURIComponent(activeBookId)}&month=${encodeURIComponent(month)}`
    );
    if (!res.ok) {
      setError(res.error);
      setEntriesLoadingByAccount((prev) => ({ ...prev, [accountId]: false }));
      return;
    }
    setError(null);
    setEntriesByAccount((prev) => ({ ...prev, [accountId]: res.data }));
    setEntriesLoadingByAccount((prev) => ({ ...prev, [accountId]: false }));
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
        <div className="small-muted mb-3">Selecione um book ativo para visualizar o relatório.</div>
        <div className="alert alert-warning mb-0" role="alert">
          Nenhum book ativo encontrado.
        </div>
      </div>
    );
  }

  const currencyMnemonic = report?.currency_mnemonic || "BRL";
  const previousMonthComparison = report?.comparisons?.previous_month;
  const sameMonthLastYearComparison = report?.comparisons?.same_month_last_year;

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h2 className="mb-1">DRE Mensal</h2>
          <div className="small-muted">
            Book ativo: <span className="fw-semibold">{activeBook?.name || activeBook?.id}</span>
          </div>
        </div>
        <button className="btn btn-outline-secondary" type="button" onClick={loadReport} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <div className="row g-2 align-items-end mb-3">
        <div className="col-md-3">
          <label className="form-label">Competência</label>
          <input
            type="month"
            className="form-control"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
        <div className="col-md-5">
          <label className="form-label">Buscar conta</label>
          <input
            className="form-control"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome ou código"
          />
        </div>
        <div className="col-md-4">
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

      {report ? (
        <div className="income-statement-grid">
          <div className="income-statement-kpis">
            <div className="dre-kpi-card">
              <div className="dre-kpi-label">Receita Líquida</div>
              <div className="dre-kpi-value positive">
                {formatMoney(report.summary.revenue, currencyMnemonic)}
              </div>
            </div>
            <div className="dre-kpi-card">
              <div className="dre-kpi-label">Custos e Despesas</div>
              <div className="dre-kpi-value negative">
                {formatMoney(report.summary.expenses, currencyMnemonic)}
              </div>
            </div>
            <div className="dre-kpi-card">
              <div className="dre-kpi-label">Lucro Líquido</div>
              <div className={`dre-kpi-value ${report.summary.net_income >= 0 ? "positive" : "negative"}`}>
                {formatMoney(report.summary.net_income, currencyMnemonic)}
              </div>
            </div>
            <div className="dre-kpi-card">
              <div className="dre-kpi-label">Margem Líquida</div>
              <div className={`dre-kpi-value ${report.summary.margin_percent >= 0 ? "positive" : "negative"}`}>
                {formatPercent(report.summary.margin_percent)}
              </div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <div className="dre-compare-card">
                <div className="small-muted">Vs. mês anterior ({previousMonthComparison?.period || "-"})</div>
                <div className="fw-semibold">
                  {formatMoney(previousMonthComparison?.net_income || 0, currencyMnemonic)}
                </div>
                <div className="small-muted">
                  Delta lucro: {formatMoney(previousMonthComparison?.delta_net_income || 0, currencyMnemonic)} (
                  {formatPercent(previousMonthComparison?.delta_percent)})
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="dre-compare-card">
                <div className="small-muted">Vs. mesmo mês ano anterior ({sameMonthLastYearComparison?.period || "-"})</div>
                <div className="fw-semibold">
                  {formatMoney(sameMonthLastYearComparison?.net_income || 0, currencyMnemonic)}
                </div>
                <div className="small-muted">
                  Delta lucro: {formatMoney(sameMonthLastYearComparison?.delta_net_income || 0, currencyMnemonic)} (
                  {formatPercent(sameMonthLastYearComparison?.delta_percent)})
                </div>
              </div>
            </div>
          </div>

          <div className="dre-panel mb-3">
            <h3 className="h5 mb-3">Waterfall</h3>
            <div className="d-grid gap-2">
              {report.waterfall.map((item) => {
                const amount = Number(item.amount || 0);
                const width = `${Math.max((Math.abs(amount) / waterfallMax) * 100, 4)}%`;
                const tone = amount >= 0 ? "positive" : "negative";
                return (
                  <div key={`${item.group_key}:${item.label}`} className="dre-waterfall-row">
                    <div className="dre-waterfall-label">{item.label}</div>
                    <div className="dre-waterfall-bar-wrap">
                      <div className={`dre-waterfall-bar ${tone}`} style={{ width }} />
                    </div>
                    <div className={`dre-waterfall-value ${tone}`}>
                      {formatMoney(amount, currencyMnemonic)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dre-panel mb-3">
            <h3 className="h5 mb-3">Últimos 12 meses</h3>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th className="text-end">Receita</th>
                    <th className="text-end">Despesas</th>
                    <th className="text-end">Lucro</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {report.series.map((point) => {
                    const net = Number(point.net_income || 0);
                    const width = `${Math.max((Math.abs(net) / seriesNetMax) * 100, 3)}%`;
                    return (
                      <tr key={point.period}>
                        <td className="fw-semibold">{point.period}</td>
                        <td className="text-end">{formatMoney(point.revenue, currencyMnemonic)}</td>
                        <td className="text-end">{formatMoney(point.expenses, currencyMnemonic)}</td>
                        <td className={`text-end fw-semibold ${net >= 0 ? "text-success" : "text-danger"}`}>
                          {formatMoney(net, currencyMnemonic)}
                        </td>
                        <td className="dre-series-cell">
                          <div className="dre-series-track">
                            <div className={`dre-series-bar ${net >= 0 ? "positive" : "negative"}`} style={{ width }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dre-panel">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h3 className="h5 mb-0">Contas do mês</h3>
              <div className="small-muted">{filteredLines.length} conta(s) exibida(s)</div>
            </div>

            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ width: "46px" }}></th>
                    <th>Conta</th>
                    <th>Tipo</th>
                    <th className="text-end">Valor</th>
                    <th className="text-end">Lançamentos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((line) => {
                    const expanded = expandedAccountId === line.account_id;
                    const detail = entriesByAccount[line.account_id];
                    const detailLoading = Boolean(entriesLoadingByAccount[line.account_id]);
                    return (
                      <React.Fragment key={line.account_id}>
                        <tr>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => toggleAccountEntries(line.account_id)}
                            >
                              {expanded ? "−" : "+"}
                            </button>
                          </td>
                          <td>
                            <div className="fw-semibold">{line.account_name}</div>
                            <div className="small-muted">{line.account_code || "-"}</div>
                          </td>
                          <td>
                            <span className="badge badge-soft">{line.account_type}</span>
                          </td>
                          <td className="text-end fw-semibold">
                            {formatMoney(line.amount, currencyMnemonic)}
                          </td>
                          <td className="text-end">{line.transaction_count}</td>
                        </tr>

                        {expanded ? (
                          <tr>
                            <td colSpan={5} className="dre-detail-cell">
                              {detailLoading ? (
                                <div className="small-muted">Carregando lançamentos...</div>
                              ) : detail ? (
                                <div className="dre-detail-table-wrap">
                                  <div className="small-muted mb-2">
                                    Total da conta no período:{" "}
                                    <span className="fw-semibold">
                                      {formatMoney(detail.total_amount, currencyMnemonic)}
                                    </span>
                                  </div>
                                  <div className="table-responsive">
                                    <table className="table table-sm mb-0">
                                      <thead>
                                        <tr>
                                          <th>Data</th>
                                          <th>Descrição</th>
                                          <th>Memo</th>
                                          <th className="text-end">Valor</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detail.entries.length > 0 ? (
                                          detail.entries.map((entry) => (
                                            <tr key={entry.split_guid}>
                                              <td>{entry.movement_date ? entry.movement_date.slice(0, 10) : "-"}</td>
                                              <td>{entry.description || "-"}</td>
                                              <td>{entry.memo || "-"}</td>
                                              <td className="text-end">{formatMoney(entry.amount, currencyMnemonic)}</td>
                                            </tr>
                                          ))
                                        ) : (
                                          <tr>
                                            <td colSpan={4} className="small-muted">
                                              Nenhum lançamento nesta competência.
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ) : (
                                <div className="small-muted">Sem dados para esta conta.</div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}

                  {filteredLines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="small-muted">
                        Nenhuma conta encontrada para os filtros aplicados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="small-muted">{loading ? "Carregando relatório..." : "Sem dados para exibir."}</div>
      )}
    </div>
  );
}
