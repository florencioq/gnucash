import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";

function currentYear() {
  return new Date().getFullYear();
}

function currencySymbol(currencyMnemonic) {
  if (!currencyMnemonic) return "";
  try {
    const sample = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currencyMnemonic
    }).format(1);
    // "R$ 1,00" → extract everything before the first digit → "R$"
    const match = sample.match(/^[^\d]+/);
    return match ? match[0].trim() : currencyMnemonic;
  } catch (_error) {
    return currencyMnemonic;
  }
}

function formatMoneyParts(value, currencyMnemonic) {
  const numeric = Number(value || 0);
  const abs = Math.abs(numeric);
  const sign = numeric < 0 ? "-" : "";
  const symbol = currencySymbol(currencyMnemonic);

  let amount, scale;
  if (abs >= 1e9) {
    const divided = abs / 1e9;
    amount = divided.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    scale = divided < 2 ? "Bilhão" : "Bilhões";
  } else if (abs >= 1e6) {
    const divided = abs / 1e6;
    amount = divided.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    scale = divided < 2 ? "Milhão" : "Milhões";
  } else if (abs >= 1e3) {
    amount = (abs / 1e3).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    scale = "Mil";
  } else {
    amount = abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    scale = "";
  }

  return { symbol, amount: sign + amount, scale };
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
  if (value == null) return "—";
  const numeric = Number(value);
  const sign = numeric >= 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(numeric)}%`;
}

export default function FinancialDashboardPage() {
  const { activeBook, activeBookId, activeBookError } = useActiveBook();
  const [year, setYear] = useState(() => currentYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!activeBookId) return;
    setLoading(true);
    const res = await api.get(
      `/reports/financial-dashboard?book_id=${encodeURIComponent(activeBookId)}&year=${encodeURIComponent(year)}`
    );
    if (!res.ok) {
      setError(res.error);
      setData(null);
      setLoading(false);
      return;
    }
    setError(null);
    setData(res.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!activeBookId) return;
    load();
  }, [activeBookId, year]);

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
        <h2 className="mb-1">Painel Financeiro</h2>
        <div className="alert alert-warning mb-0" role="alert">
          Nenhum livro ativo encontrado.
        </div>
      </div>
    );
  }

  const currency = data?.currency_mnemonic || "BRL";
  const netIncome = Number(data?.net_income || 0);
  const revenue = Number(data?.revenue || 0);
  const expenses = Number(data?.expenses || 0);
  const marginPercent = data?.margin_percent ?? null;
  const annualGrowth = data?.annual_growth_percent ?? null;
  const allPositive = Boolean(data?.all_quarters_positive);
  const positiveCount = Number(data?.positive_quarters_count || 0);

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h2 className="mb-1">Painel Financeiro</h2>
          <div className="small-muted">
            Livro ativo: <span className="fw-semibold">{activeBook?.name || activeBook?.id}</span>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <div>
            <label className="form-label mb-0 me-1 small-muted">Ano</label>
            <input
              type="number"
              className="form-control form-control-sm"
              style={{ width: "90px", display: "inline-block" }}
              value={year}
              min={1900}
              max={3000}
              onChange={(event) => {
                const v = parseInt(event.target.value, 10);
                if (v >= 1900 && v <= 3000) setYear(v);
              }}
            />
          </div>
          <button
            className="btn btn-outline-secondary btn-sm"
            type="button"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error.code}: {error.message}
        </div>
      ) : null}

      {data ? (
        <>
          {/* Main KPI grid — 2 columns, 3 rows */}
          <div className="fin-dashboard-grid mb-3">
            {/* Receita Líquida */}
            {(() => {
              const { symbol, amount, scale } = formatMoneyParts(revenue, currency);
              return (
                <div className="fin-kpi-card">
                  <div className="fin-kpi-icon">📈</div>
                  <div className="fin-kpi-label">Receita Líquida</div>
                  <div className={`fin-kpi-value ${revenue >= 0 ? "positive" : "negative"}`}>
                    <span className="fin-kpi-symbol">{symbol || currency}</span> {amount}
                  </div>
                  {scale && <div className="fin-kpi-scale">{scale}</div>}
                  {annualGrowth != null ? (
                    <div className="fin-kpi-sub">
                      Variação anual: <strong>{formatPercent(annualGrowth)}</strong>
                    </div>
                  ) : (
                    <div className="fin-kpi-sub">Sem dados do ano anterior</div>
                  )}
                </div>
              );
            })()}

            {/* Banner crescimento */}
            <div className={`fin-banner-card${allPositive ? "" : " neutral"}`}>
              {allPositive ? (
                <>
                  <div className="fin-banner-arrow">↑</div>
                  <div className="fin-banner-title">Crescimento em todos os trimestres</div>
                  <div className="fin-kpi-sub" style={{ color: "#a7f3d0", marginTop: "0.4rem" }}>
                    4 de 4 trimestres com resultado positivo
                  </div>
                </>
              ) : (
                <>
                  <div className={`fin-banner-arrow${positiveCount === 0 ? " down" : ""}`}>
                    {positiveCount > 0 ? "↗" : "↓"}
                  </div>
                  <div className="fin-banner-title">
                    {positiveCount} de 4 trimestres com lucro
                  </div>
                  <div className="fin-kpi-sub" style={{ color: "#cbd5e1", marginTop: "0.4rem" }}>
                    {positiveCount === 0 ? "Todos os trimestres negativos" : "Crescimento parcial no período"}
                  </div>
                </>
              )}
            </div>

            {/* Resultado Líquido */}
            {(() => {
              const { symbol, amount, scale } = formatMoneyParts(netIncome, currency);
              return (
                <div className="fin-kpi-card">
                  <div className="fin-kpi-icon">💰</div>
                  <div className="fin-kpi-label">Resultado Líquido</div>
                  <div className={`fin-kpi-value ${netIncome >= 0 ? "positive" : "negative"}`}>
                    <span className="fin-kpi-symbol">{symbol || currency}</span> {amount}
                  </div>
                  {scale && <div className="fin-kpi-scale">{scale}</div>}
                  <div className="fin-kpi-sub">Receita − Despesas</div>
                </div>
              );
            })()}

            {/* Margem Líquida */}
            <div className="fin-kpi-card">
              <div className="fin-kpi-icon">📊</div>
              <div className="fin-kpi-label">Margem Líquida</div>
              <div className={`fin-kpi-value ${marginPercent == null ? "" : marginPercent >= 0 ? "positive" : "negative"}`}>
                {marginPercent != null ? `${Number(marginPercent).toFixed(1).replace(".", ",")}%` : "—"}
              </div>
              <div className="fin-kpi-sub">Resultado / Receita</div>
            </div>

            {/* Despesas */}
            {(() => {
              const { symbol, amount, scale } = formatMoneyParts(expenses, currency);
              return (
                <div className="fin-kpi-card">
                  <div className="fin-kpi-icon">💸</div>
                  <div className="fin-kpi-label">Total Despesas</div>
                  <div className="fin-kpi-value negative">
                    <span className="fin-kpi-symbol">{symbol || currency}</span> {amount}
                  </div>
                  {scale && <div className="fin-kpi-scale">{scale}</div>}
                  <div className="fin-kpi-sub">Soma de todas as despesas</div>
                </div>
              );
            })()}

            {/* Variação Anual */}
            {(() => {
              const prevNet = data.prev_year_net_income;
              const { symbol, amount, scale } = prevNet != null
                ? formatMoneyParts(prevNet, currency)
                : { symbol: "", amount: "—", scale: "" };
              return (
                <div className="fin-kpi-card">
                  <div className="fin-kpi-icon">📅</div>
                  <div className="fin-kpi-label">Variação Anual</div>
                  <div className={`fin-kpi-value ${annualGrowth == null ? "" : annualGrowth >= 0 ? "positive" : "negative"}`}>
                    {formatPercent(annualGrowth)}
                  </div>
                  <div className="fin-kpi-sub">
                    {year - 1}:{" "}
                    {prevNet != null && <span>{symbol || currency} {amount}{scale ? ` ${scale}` : ""}</span>}
                    {prevNet == null && "—"}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Quarterly cards */}
          {data.quarters?.length > 0 ? (
            <>
              <div className="small-muted mb-2 fw-semibold">Resultados trimestrais</div>
              <div className="fin-quarters-row mb-0">
                {data.quarters.map((qt) => {
                  const qNet = Number(qt.net_income || 0);
                  const { symbol: sym, amount: amt, scale: scl } = formatMoneyParts(qNet, currency);
                  return (
                    <div key={qt.quarter} className="fin-quarter-card">
                      <div className="fin-quarter-label">{qt.label}</div>
                      <div className={`fin-quarter-value ${qNet >= 0 ? "positive" : "negative"}`}>
                        <span className="fin-kpi-symbol" style={{ fontSize: "0.75em" }}>{sym || currency}</span> {amt}
                      </div>
                      {scl && <div className="fin-kpi-scale" style={{ fontSize: "0.72rem" }}>{scl}</div>}
                      <div className="fin-kpi-sub" style={{ fontSize: "0.72rem" }}>
                        Rec: {formatMoney(qt.revenue, currency)}
                      </div>
                      <div className="fin-kpi-sub" style={{ fontSize: "0.72rem" }}>
                        Desp: {formatMoney(qt.expenses, currency)}
                      </div>
                      {qt.growth_percent != null ? (
                        <div
                          className={`fin-kpi-sub ${qt.growth_percent >= 0 ? "positive" : "negative"}`}
                          style={{ fontSize: "0.72rem", fontWeight: 600 }}
                        >
                          {formatPercent(qt.growth_percent)} vs {year - 1}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </>
      ) : loading ? (
        <div className="small-muted">Carregando indicadores...</div>
      ) : null}
    </div>
  );
}
