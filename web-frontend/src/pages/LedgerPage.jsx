import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDecimal(input) {
  if (typeof input !== "string") return Number.NaN;
  const normalized = input.trim().replace(",", ".");
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function formatDate(iso) {
  if (!iso) return "-";
  const raw = String(iso);
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

function formatAmount(value, mnemonic) {
  if (mnemonic && mnemonic.length === 3) {
    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: mnemonic
      }).format(value);
    } catch (_error) {
      // Fall through to decimal formatting.
    }
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function filterTree(nodes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const visit = (node) => {
    const selfMatch =
      (node.name || "").toLowerCase().includes(q) ||
      (node.type || "").toLowerCase().includes(q);
    const children = (node.children || []).map(visit).filter(Boolean);
    if (selfMatch || children.length > 0) {
      return { ...node, children };
    }
    return null;
  };

  return nodes.map(visit).filter(Boolean);
}

export default function LedgerPage({ initialBookId = "", initialAccountId = "" }) {
  const [books, setBooks] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountTree, setAccountTree] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedBook, setSelectedBook] = useState(initialBookId || "");
  const [ledgerAccountId, setLedgerAccountId] = useState(initialAccountId || "");
  const [ledgerPickerOpen, setLedgerPickerOpen] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [counterPickerOpen, setCounterPickerOpen] = useState(false);
  const [counterSearch, setCounterSearch] = useState("");
  const [error, setError] = useState(null);
  const [deletingTxGuid, setDeletingTxGuid] = useState("");
  const [ledgerForm, setLedgerForm] = useState({
    counterAccountId: "",
    date: todayIsoDate(),
    description: "",
    amount: ""
  });

  const commoditiesById = useMemo(
    () => new Map(commodities.map((commodity) => [commodity.id, commodity])),
    [commodities]
  );
  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );
  const accountFullNameById = useMemo(() => {
    const cache = new Map();

    const build = (accountId, visited = new Set()) => {
      if (cache.has(accountId)) return cache.get(accountId);
      if (visited.has(accountId)) return accountsById.get(accountId)?.name || accountId;
      visited.add(accountId);

      const account = accountsById.get(accountId);
      if (!account) return accountId;
      if (!account.parent_id) {
        cache.set(accountId, account.name);
        return account.name;
      }

      const parentName = build(account.parent_id, visited);
      const fullName = `${parentName} / ${account.name}`;
      cache.set(accountId, fullName);
      return fullName;
    };

    for (const account of accounts) {
      build(account.id);
    }

    return cache;
  }, [accounts, accountsById]);

  const loadBooks = async () => {
    const res = await api.get("/books");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBooks(res.data);
    if (!selectedBook && res.data.length > 0) {
      setSelectedBook(initialBookId || res.data[0].id);
    }
  };

  const loadCommodities = async () => {
    const res = await api.get("/commodities?namespace=CURRENCY");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCommodities(res.data);
  };

  const loadAccounts = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/accounts?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAccounts(res.data);
    setLedgerAccountId((current) => {
      const available = res.data.filter((account) => account.type !== "ROOT");
      const fallback = (available[0] || res.data[0] || {}).id || "";
      if (!current) return initialAccountId || fallback;
      return res.data.some((account) => account.id === current)
        ? current
        : initialAccountId || fallback;
    });
  };

  const loadAccountTree = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/accounts/tree?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAccountTree(res.data);
  };

  const loadTransactions = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/transactions?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTransactions(res.data);
  };

  useEffect(() => {
    loadBooks();
    loadCommodities();
  }, []);

  useEffect(() => {
    if (selectedBook) {
      Promise.all([
        loadAccounts(selectedBook),
        loadAccountTree(selectedBook),
        loadTransactions(selectedBook)
      ]);
    }
  }, [selectedBook]);

  useEffect(() => {
    if (initialBookId) {
      setSelectedBook(initialBookId);
    }
  }, [initialBookId]);

  useEffect(() => {
    if (initialAccountId && accounts.some((account) => account.id === initialAccountId)) {
      setLedgerAccountId(initialAccountId);
    }
  }, [initialAccountId, accounts]);

  useEffect(() => {
    const candidates = accounts.filter(
      (account) => account.type !== "ROOT" && account.id !== ledgerAccountId
    );
    setLedgerForm((current) => {
      const fallbackCounter = (candidates[0] || {}).id || "";
      const currentIsValid = candidates.some(
        (account) => account.id === current.counterAccountId
      );
      const nextCounter = currentIsValid ? current.counterAccountId : fallbackCounter;
      if (nextCounter === current.counterAccountId) return current;
      return { ...current, counterAccountId: nextCounter };
    });
  }, [ledgerAccountId, accounts]);

  const ledgerRows = useMemo(() => {
    if (!ledgerAccountId) return [];

    const rows = [];
    for (const tx of transactions) {
      const ownSplit = tx.splits.find((split) => split.account_guid === ledgerAccountId);
      if (!ownSplit) continue;

      const contraSplits = tx.splits.filter((split) => split.account_guid !== ledgerAccountId);
      const contraLabel =
        contraSplits
          .map((split) => accountsById.get(split.account_guid)?.name || split.account_guid)
          .join(", ") || "-";
      const amount = ownSplit.value_num / ownSplit.value_denom;
      const movementDate = tx.post_date || tx.enter_date;
      rows.push({
        key: `${tx.guid}:${ownSplit.guid}`,
        txGuid: tx.guid,
        date: movementDate,
        history: tx.description || ownSplit.memo || "-",
        contra: contraLabel,
        debit: amount > 0 ? amount : 0,
        credit: amount < 0 ? Math.abs(amount) : 0,
        amount
      });
    }

    rows.sort((a, b) => {
      const da = a.date || "";
      const db = b.date || "";
      if (da === db) return a.txGuid.localeCompare(b.txGuid);
      return da.localeCompare(db);
    });

    let runningBalance = 0;
    return rows.map((row) => {
      runningBalance += row.amount;
      return { ...row, balance: runningBalance };
    });
  }, [transactions, ledgerAccountId, accountsById]);

  const selectedLedgerAccount = accountsById.get(ledgerAccountId) || null;
  const selectedCounterAccount = accountsById.get(ledgerForm.counterAccountId) || null;
  const ledgerAccountLabel = selectedLedgerAccount
    ? `${accountFullNameById.get(selectedLedgerAccount.id) || selectedLedgerAccount.name} (${selectedLedgerAccount.type})`
    : "Selecione a conta do razao";
  const counterAccountLabel = selectedCounterAccount
    ? `${accountFullNameById.get(selectedCounterAccount.id) || selectedCounterAccount.name} (${selectedCounterAccount.type})`
    : "Selecione a conta de contra-partida";
  const ledgerCommodity = selectedLedgerAccount
    ? commoditiesById.get(selectedLedgerAccount.commodity_id) || null
    : null;
  const currentBalance = ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].balance : 0;
  const enteredAmount = parseDecimal(ledgerForm.amount);
  const projectedBalance = Number.isFinite(enteredAmount)
    ? currentBalance + enteredAmount
    : currentBalance;

  const visibleCounterTree = useMemo(
    () => filterTree(accountTree, counterSearch),
    [accountTree, counterSearch]
  );

  const visibleLedgerTree = useMemo(
    () => filterTree(accountTree, ledgerSearch),
    [accountTree, ledgerSearch]
  );

  const selectLedgerAccount = (accountId) => {
    setLedgerAccountId(accountId);
    setLedgerSearch("");
    setLedgerPickerOpen(false);
  };

  const toggleLedgerPicker = () => {
    setLedgerPickerOpen((current) => {
      const next = !current;
      if (next) {
        setLedgerSearch("");
      }
      return next;
    });
  };

  const selectCounterAccount = (accountId) => {
    setLedgerForm((current) => ({ ...current, counterAccountId: accountId }));
    setCounterSearch("");
    setCounterPickerOpen(false);
  };

  const toggleCounterPicker = () => {
    setCounterPickerOpen((current) => {
      const next = !current;
      if (next) {
        setCounterSearch("");
      }
      return next;
    });
  };

  const renderLedgerTreeNodes = (nodes, depth = 0) => {
    return nodes.map((node) => {
      const isRoot = node.type === "ROOT";
      const selected = ledgerAccountId === node.id;

      return (
        <div key={node.id}>
          <button
            type="button"
            className={`counter-tree-node ${selected ? "is-selected" : ""}`}
            style={{ marginLeft: `${depth * 14}px` }}
            disabled={isRoot}
            onClick={() => selectLedgerAccount(node.id)}
          >
            <span className="counter-tree-name">{node.name}</span>
            <span className="badge badge-soft text-uppercase">{node.type}</span>
          </button>
          {node.children && node.children.length > 0
            ? renderLedgerTreeNodes(node.children, depth + 1)
            : null}
        </div>
      );
    });
  };

  const renderCounterTreeNodes = (nodes, depth = 0) => {
    return nodes.map((node) => {
      const isRoot = node.type === "ROOT";
      const isSameAsLedger = node.id === ledgerAccountId;
      const disabled = isRoot || isSameAsLedger;
      const selected = ledgerForm.counterAccountId === node.id;

      return (
        <div key={node.id}>
          <button
            type="button"
            className={`counter-tree-node ${selected ? "is-selected" : ""}`}
            style={{ marginLeft: `${depth * 14}px` }}
            disabled={disabled}
            onClick={() => selectCounterAccount(node.id)}
          >
            <span className="counter-tree-name">{node.name}</span>
            <span className="badge badge-soft text-uppercase">{node.type}</span>
          </button>
          {node.children && node.children.length > 0
            ? renderCounterTreeNodes(node.children, depth + 1)
            : null}
        </div>
      );
    });
  };

  const createLedgerEntry = async (event) => {
    event.preventDefault();
    setError(null);

    if (!ledgerAccountId) {
      setError({ code: "VALIDATION_ERROR", message: "selecione uma conta para o razao", details: {} });
      return;
    }
    if (!ledgerForm.counterAccountId) {
      setError({ code: "VALIDATION_ERROR", message: "selecione a conta de contra-partida", details: {} });
      return;
    }
    if (!ledgerForm.date) {
      setError({ code: "VALIDATION_ERROR", message: "informe a data do lancamento", details: {} });
      return;
    }

    const value = parseDecimal(ledgerForm.amount);
    if (!Number.isFinite(value) || value === 0) {
      setError({ code: "VALIDATION_ERROR", message: "informe um valor diferente de zero", details: {} });
      return;
    }

    const account = accountsById.get(ledgerAccountId);
    const counterAccount = accountsById.get(ledgerForm.counterAccountId);
    if (!account || !counterAccount) {
      setError({ code: "VALIDATION_ERROR", message: "conta invalida no lancamento", details: {} });
      return;
    }
    if (account.commodity_id !== counterAccount.commodity_id) {
      setError({
        code: "VALIDATION_ERROR",
        message: "contas do lancamento devem usar a mesma commodity",
        details: {}
      });
      return;
    }

    const fraction = (commoditiesById.get(account.commodity_id) || {}).fraction || 100;
    const valueNum = Math.round(value * fraction);
    if (valueNum === 0) {
      setError({
        code: "VALIDATION_ERROR",
        message: "valor abaixo da menor unidade da moeda",
        details: { fraction }
      });
      return;
    }

    const history = ledgerForm.description.trim();
    const payload = {
      currency_guid: account.commodity_id,
      post_date: `${ledgerForm.date}T00:00:00Z`,
      description: history || null,
      splits: [
        {
          account_guid: account.id,
          memo: history,
          action: "",
          reconcile_state: "n",
          value_num: valueNum,
          value_denom: fraction,
          quantity_num: valueNum,
          quantity_denom: fraction
        },
        {
          account_guid: counterAccount.id,
          memo: history,
          action: "",
          reconcile_state: "n",
          value_num: -valueNum,
          value_denom: fraction,
          quantity_num: -valueNum,
          quantity_denom: fraction
        }
      ]
    };

    const res = await api.post("/transactions", payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setLedgerForm((current) => ({
      ...current,
      description: "",
      amount: ""
    }));
    await loadTransactions(selectedBook);
  };

  const deleteLedgerEntry = async (txGuid) => {
    if (!txGuid) return;
    const confirmed = window.confirm("Deseja excluir este lancamento do razao?");
    if (!confirmed) return;

    setError(null);
    setDeletingTxGuid(txGuid);
    const res = await api.del(`/transactions/${txGuid}`);
    setDeletingTxGuid("");

    if (!res.ok) {
      setError(res.error);
      return;
    }
    await loadTransactions(selectedBook);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Ledger</h2>
          <div className="small-muted">Razao da conta com lancamento direto.</div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <label className="form-label">Book</label>
          <select
            className="form-select"
            value={selectedBook}
            onChange={(event) => setSelectedBook(event.target.value)}
          >
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.name || book.id}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-8">
          <label className="form-label">Conta do razao</label>
          <div className="tree-select">
            <button
              type="button"
              className="form-select tree-select-toggle"
              onClick={toggleLedgerPicker}
            >
              <span className="tree-select-label">{ledgerAccountLabel}</span>
              <span className="tree-select-caret">{ledgerPickerOpen ? "▲" : "▼"}</span>
            </button>
            {ledgerPickerOpen ? (
              <div className="tree-select-menu">
                <input
                  className="form-control mb-2"
                  value={ledgerSearch}
                  onChange={(event) => setLedgerSearch(event.target.value)}
                  placeholder="Filtrar conta do razao"
                />
                <div className="counter-tree-panel">
                  {visibleLedgerTree.length > 0 ? (
                    renderLedgerTreeNodes(visibleLedgerTree)
                  ) : (
                    <div className="small-muted">Nenhuma conta encontrada para o filtro informado.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error.code}: {error.message}
        </div>
      ) : null}

      <div className="table-responsive mb-3">
        <table className="table table-sm align-middle ledger-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Historico</th>
              <th>Contra-partida</th>
              <th className="text-end">Debito</th>
              <th className="text-end">Credito</th>
              <th className="text-end">Saldo</th>
              <th className="text-end">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="small-muted">
                  Nenhum lancamento para a conta selecionada.
                </td>
              </tr>
            ) : (
              ledgerRows.map((row) => (
                <tr key={row.key}>
                  <td>{formatDate(row.date)}</td>
                  <td>{row.history}</td>
                  <td>{row.contra}</td>
                  <td className="text-end">{row.debit ? formatAmount(row.debit, ledgerCommodity?.mnemonic) : "-"}</td>
                  <td className="text-end">{row.credit ? formatAmount(row.credit, ledgerCommodity?.mnemonic) : "-"}</td>
                  <td className="text-end fw-semibold">{formatAmount(row.balance, ledgerCommodity?.mnemonic)}</td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => deleteLedgerEntry(row.txGuid)}
                      disabled={deletingTxGuid === row.txGuid}
                    >
                      {deletingTxGuid === row.txGuid ? "Excluindo..." : "Excluir"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form className="row g-2 align-items-end" onSubmit={createLedgerEntry}>
        <div className="col-md-2">
          <label className="form-label">Data</label>
          <input
            className="form-control"
            type="date"
            value={ledgerForm.date}
            onChange={(event) => setLedgerForm({ ...ledgerForm, date: event.target.value })}
            required
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Historico</label>
          <input
            className="form-control"
            value={ledgerForm.description}
            onChange={(event) => setLedgerForm({ ...ledgerForm, description: event.target.value })}
            placeholder="Descricao do lancamento"
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Valor</label>
          <input
            className="form-control"
            value={ledgerForm.amount}
            onChange={(event) => setLedgerForm({ ...ledgerForm, amount: event.target.value })}
            placeholder="0,00"
            required
          />
        </div>
        <div className="col-md-5">
          <label className="form-label">Conta de contra-partida (arvore)</label>
          <div className="tree-select">
            <button
              type="button"
              className="form-select tree-select-toggle"
              onClick={toggleCounterPicker}
            >
              <span className="tree-select-label">{counterAccountLabel}</span>
              <span className="tree-select-caret">{counterPickerOpen ? "▲" : "▼"}</span>
            </button>
            {counterPickerOpen ? (
              <div className="tree-select-menu">
                <input
                  className="form-control mb-2"
                  value={counterSearch}
                  onChange={(event) => setCounterSearch(event.target.value)}
                  placeholder="Filtrar conta de contra-partida"
                />
                <div className="counter-tree-panel">
                  {visibleCounterTree.length > 0 ? (
                    renderCounterTreeNodes(visibleCounterTree)
                  ) : (
                    <div className="small-muted">Nenhuma conta encontrada para o filtro informado.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="col-md-12 mt-2 d-flex justify-content-end">
          <button className="btn btn-accent" type="submit">
            Lancar no Razao
          </button>
        </div>
      </form>

      <div className="d-flex flex-wrap gap-4 mt-3 small-muted">
        <div>
          Saldo atual: <span className="fw-semibold text-dark">{formatAmount(currentBalance, ledgerCommodity?.mnemonic)}</span>
        </div>
        <div>
          Saldo projetado: <span className="fw-semibold text-dark">{formatAmount(projectedBalance, ledgerCommodity?.mnemonic)}</span>
        </div>
      </div>
    </div>
  );
}
