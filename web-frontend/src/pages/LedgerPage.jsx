import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDecimal(input) {
  if (typeof input !== "string") return Number.NaN;
  const trimmed = input.trim();
  if (!trimmed) return Number.NaN;
  // pt-BR: dots are thousands separators, comma is decimal separator
  if (trimmed.includes(",")) {
    return Number(trimmed.replace(/\./g, "").replace(",", "."));
  }
  return Number(trimmed);
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

function formatAmountInput(value) {
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

export default function LedgerPage({
  initialAccountId = "",
  returnTab = "",
  onReturnToTab = () => {},
  onLedgerAccountChange = () => {},
  onOpenInvoicing = () => {},
  onOpenBilling = () => {}
}) {
  const [commodities, setCommodities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountTree, setAccountTree] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [sourceByTxGuid, setSourceByTxGuid] = useState({});
  const [ledgerAccountId, setLedgerAccountId] = useState(initialAccountId || "");
  const { activeBook, activeBookId, activeBookError } = useActiveBook();
  const returnToInvoice = returnTab === "invoicing" || returnTab.startsWith("invoice:");
  const returnToBilling = returnTab === "billing" || returnTab.startsWith("bill:");
  const [ledgerPickerOpen, setLedgerPickerOpen] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [counterPickerOpen, setCounterPickerOpen] = useState(false);
  const [counterSearch, setCounterSearch] = useState("");
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingTxGuid, setEditingTxGuid] = useState("");
  const [savingTxGuid, setSavingTxGuid] = useState("");
  const [deletingTxGuid, setDeletingTxGuid] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [chronologicalOrder, setChronologicalOrder] = useState("desc");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
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
  const transactionsById = useMemo(
    () => new Map(transactions.map((tx) => [tx.guid, tx])),
    [transactions]
  );
  const accountFullNameById = useMemo(() => {
    const cache = new Map();

    const build = (accountId, visited = new Set()) => {
      if (cache.has(accountId)) return cache.get(accountId);
      if (visited.has(accountId)) return accountsById.get(accountId)?.name || accountId;
      visited.add(accountId);

      const account = accountsById.get(accountId);
      if (!account) return accountId;
      if (account.type === "ROOT" || !account.parent_id) {
        cache.set(accountId, account.name);
        return account.name;
      }

      const parentName = build(account.parent_id, visited);
      const parent = accountsById.get(account.parent_id);
      const fullName =
        parent?.type === "ROOT"
          ? account.name
          : `${parentName} / ${account.name}`;
      cache.set(accountId, fullName);
      return fullName;
    };

    for (const account of accounts) {
      build(account.id);
    }

    return cache;
  }, [accounts, accountsById]);

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

  const loadSourceLinks = async (bookId) => {
    if (!bookId) return;
    const [invoicesRes, billsRes] = await Promise.all([
      api.get(`/invoices/source-links?book_id=${bookId}`),
      api.get(`/bills/source-links?book_id=${bookId}`)
    ]);

    const mapping = {};
    if (invoicesRes.ok) {
      for (const invoice of invoicesRes.data) {
        if (invoice.post_tx_guid) {
          mapping[invoice.post_tx_guid] = {
            sourceType: "invoicing",
            documentGuid: invoice.guid,
            documentId: invoice.id,
            relation: "post"
          };
        }
        for (const paymentTxGuid of invoice.payment_tx_guids || []) {
          mapping[paymentTxGuid] = {
            sourceType: "invoicing",
            documentGuid: invoice.guid,
            documentId: invoice.id,
            relation: "payment"
          };
        }
      }
    }

    if (billsRes.ok) {
      for (const bill of billsRes.data) {
        if (bill.post_tx_guid) {
          mapping[bill.post_tx_guid] = {
            sourceType: "billing",
            documentGuid: bill.guid,
            documentId: bill.id,
            relation: "post"
          };
        }
        for (const paymentTxGuid of bill.payment_tx_guids || []) {
          mapping[paymentTxGuid] = {
            sourceType: "billing",
            documentGuid: bill.guid,
            documentId: bill.id,
            relation: "payment"
          };
        }
      }
    }

    setSourceByTxGuid(mapping);
  };

  const refreshLedgerData = async (bookId, includeCommodities = false) => {
    if (!bookId) return;
    setRefreshing(true);
    setError(null);
    try {
      if (includeCommodities) {
        await loadCommodities();
      }
      await Promise.all([
        loadAccounts(bookId),
        loadAccountTree(bookId),
        loadTransactions(bookId),
        loadSourceLinks(bookId)
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCommodities();
  }, []);

  useEffect(() => {
    if (activeBookId) {
      refreshLedgerData(activeBookId);
    }
  }, [activeBookId]);

  useEffect(() => {
    if (initialAccountId && accounts.some((account) => account.id === initialAccountId)) {
      setLedgerAccountId(initialAccountId);
    }
  }, [initialAccountId, accounts]);

  useEffect(() => {
    onLedgerAccountChange(ledgerAccountId || "");
  }, [ledgerAccountId, onLedgerAccountChange]);

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

  useEffect(() => {
    setPage(1);
  }, [ledgerAccountId]);

  useEffect(() => {
    setEditingTxGuid("");
    setSavingTxGuid("");
  }, [ledgerAccountId, activeBookId]);

  useEffect(() => {
    if (editingTxGuid && !transactionsById.has(editingTxGuid)) {
      setEditingTxGuid("");
      setSavingTxGuid("");
    }
  }, [editingTxGuid, transactionsById]);

  const ledgerRows = useMemo(() => {
    if (!ledgerAccountId) return [];

    const rows = [];
    transactions.forEach((tx, txOrder) => {
      const ownSplit = tx.splits.find((split) => split.account_guid === ledgerAccountId);
      if (!ownSplit) return;

      const contraSplits = tx.splits.filter((split) => split.account_guid !== ledgerAccountId);
      const contraAccounts = contraSplits.map((split) => {
        const accountId = split.account_guid || "";
        const account = accountsById.get(accountId) || null;
        return {
          accountId,
          label: account
            ? accountFullNameById.get(accountId) || account.name
            : accountId
        };
      });
      const contraLabel = contraAccounts.map((account) => account.label).join(", ") || "-";
      const amount = ownSplit.value_num / ownSplit.value_denom;
      const movementDate = tx.post_date || tx.enter_date;
      rows.push({
        key: `${tx.guid}:${ownSplit.guid}`,
        txGuid: tx.guid,
        date: movementDate,
        enterDate: tx.enter_date || "",
        txOrder,
        history: tx.description || ownSplit.memo || "-",
        contra: contraLabel,
        contraAccounts,
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        amount
      });
    });

    rows.sort((a, b) => {
      const da = a.date || "";
      const db = b.date || "";
      if (da !== db) return da.localeCompare(db);
      const ea = a.enterDate || "";
      const eb = b.enterDate || "";
      if (ea !== eb) return ea.localeCompare(eb);
      if (a.txOrder !== b.txOrder) return a.txOrder - b.txOrder;
      if (a.txGuid !== b.txGuid) return a.txGuid.localeCompare(b.txGuid);
      return a.key.localeCompare(b.key);
    });

    let runningBalance = 0;
    return rows.map((row) => {
      runningBalance += row.amount;
      return { ...row, balance: runningBalance };
    });
  }, [transactions, ledgerAccountId, accountsById, accountFullNameById]);

  const selectedLedgerAccount = accountsById.get(ledgerAccountId) || null;
  const selectedCounterAccount = accountsById.get(ledgerForm.counterAccountId) || null;
  const ledgerAccountLabel = selectedLedgerAccount
    ? `${accountFullNameById.get(selectedLedgerAccount.id) || selectedLedgerAccount.name} (${selectedLedgerAccount.type})`
    : "Selecione a conta do razão";
  const counterAccountLabel = selectedCounterAccount
    ? `${accountFullNameById.get(selectedCounterAccount.id) || selectedCounterAccount.name} (${selectedCounterAccount.type})`
    : "Selecione a conta de contra-partida";
  const ledgerCommodity = selectedLedgerAccount
    ? commoditiesById.get(selectedLedgerAccount.commodity_id) || null
    : null;
  const debitHeaderLabel = "Saque";
  const creditHeaderLabel = "Depósito";
  const currentBalance = ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].balance : 0;
  const orderedLedgerRows = useMemo(
    () => (chronologicalOrder === "asc" ? ledgerRows : [...ledgerRows].reverse()),
    [ledgerRows, chronologicalOrder]
  );
  const dateFilteredRows = useMemo(() => {
    if (!filterDateFrom && !filterDateTo) return orderedLedgerRows;
    return orderedLedgerRows.filter((row) => {
      const d = (row.date || "").slice(0, 10);
      if (filterDateFrom && d < filterDateFrom) return false;
      if (filterDateTo && d > filterDateTo) return false;
      return true;
    });
  }, [orderedLedgerRows, filterDateFrom, filterDateTo]);
  const totalItems = dateFilteredRows.length;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / pageSize);
  const currentPage = totalItems === 0 ? 1 : Math.min(page, totalPages);
  const pagedLedgerRows = useMemo(() => {
    const offset = (currentPage - 1) * pageSize;
    return dateFilteredRows.slice(offset, offset + pageSize);
  }, [dateFilteredRows, currentPage, pageSize]);
  const enteredAmount = parseDecimal(ledgerForm.amount);
  const projectedBalance = Number.isFinite(enteredAmount)
    ? currentBalance + enteredAmount
    : currentBalance;

  useEffect(() => {
    setPage(1);
  }, [filterDateFrom, filterDateTo]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

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
      if (node.type === "ROOT") {
        return (
          <div key={node.id}>
            {node.children && node.children.length > 0
              ? renderLedgerTreeNodes(node.children, depth)
              : null}
          </div>
        );
      }

      const selected = ledgerAccountId === node.id;

      return (
        <div key={node.id}>
          <button
            type="button"
            className={`counter-tree-node ${selected ? "is-selected" : ""}`}
            style={{ marginLeft: `${depth * 14}px` }}
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
      if (node.type === "ROOT") {
        return (
          <div key={node.id}>
            {node.children && node.children.length > 0
              ? renderCounterTreeNodes(node.children, depth)
              : null}
          </div>
        );
      }

      const isSameAsLedger = node.id === ledgerAccountId;
      const disabled = isSameAsLedger;
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

  const getEditableTransactionContext = (txGuid) => {
    const tx = transactionsById.get(txGuid);
    if (!tx) return null;

    const ownSplits = tx.splits.filter((split) => split.account_guid === ledgerAccountId);
    const contraSplits = tx.splits.filter((split) => split.account_guid !== ledgerAccountId);
    if (ownSplits.length !== 1 || contraSplits.length !== 1) {
      return null;
    }

    return { tx, ownSplit: ownSplits[0], contraSplit: contraSplits[0] };
  };

  const isTransactionLinkedToDocument = (txGuid) =>
    Boolean(sourceByTxGuid[txGuid]?.documentGuid);

  const startEditingLedgerEntry = (txGuid) => {
    setError(null);
    if (isTransactionLinkedToDocument(txGuid)) {
      setError({
        code: "VALIDATION_ERROR",
        message: "lançamentos de faturamentos/compras devem ser alterados nas telas de Faturamentos/Compras",
        details: {}
      });
      return;
    }

    const context = getEditableTransactionContext(txGuid);
    if (!context) {
      setError({
        code: "VALIDATION_ERROR",
        message: "edição disponível apenas para lançamentos com uma única contra-partida",
        details: {}
      });
      return;
    }

    const { tx, ownSplit, contraSplit } = context;
    const movementDate = (tx.post_date || tx.enter_date || "").slice(0, 10) || todayIsoDate();
    const history = (tx.description || ownSplit.memo || "").trim();
    const amount = ownSplit.value_num / ownSplit.value_denom;

    setLedgerForm((current) => ({
      ...current,
      counterAccountId: contraSplit.account_guid,
      date: movementDate,
      description: history,
      amount: formatAmountInput(amount)
    }));
    setCounterPickerOpen(false);
    setCounterSearch("");
    setEditingTxGuid(txGuid);
  };

  const cancelEditingLedgerEntry = () => {
    setEditingTxGuid("");
    setSavingTxGuid("");
    setError(null);
    setLedgerForm((current) => ({
      ...current,
      description: "",
      amount: ""
    }));
  };

  const createLedgerEntry = async (event) => {
    event.preventDefault();
    setError(null);

    if (!ledgerAccountId) {
      setError({ code: "VALIDATION_ERROR", message: "selecione uma conta para o razão", details: {} });
      return;
    }
    if (!ledgerForm.counterAccountId) {
      setError({ code: "VALIDATION_ERROR", message: "selecione a conta de contra-partida", details: {} });
      return;
    }
    if (!ledgerForm.date) {
      setError({ code: "VALIDATION_ERROR", message: "informe a data do lançamento", details: {} });
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
      setError({ code: "VALIDATION_ERROR", message: "conta inválida no lançamento", details: {} });
      return;
    }
    if (account.commodity_id !== counterAccount.commodity_id) {
      setError({
        code: "VALIDATION_ERROR",
        message: "contas do lançamento devem usar a mesma commodity",
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

    const txGuidInFlight = editingTxGuid;
    if (txGuidInFlight && isTransactionLinkedToDocument(txGuidInFlight)) {
      setSavingTxGuid("");
      setEditingTxGuid("");
      setError({
        code: "VALIDATION_ERROR",
        message: "lançamentos de faturamentos/compras devem ser alterados nas telas de Faturamentos/Compras",
        details: {}
      });
      return;
    }

    if (txGuidInFlight) {
      setSavingTxGuid(txGuidInFlight);
    }
    const res = txGuidInFlight
      ? await api.patch(`/transactions/${txGuidInFlight}`, payload)
      : await api.post("/transactions", payload);
    if (txGuidInFlight) {
      setSavingTxGuid("");
    }

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setEditingTxGuid("");
    setLedgerForm((current) => ({
      ...current,
      description: "",
      amount: ""
    }));
    await loadTransactions(activeBookId);
  };

  const deleteLedgerEntry = async (txGuid) => {
    if (!txGuid) return;
    if (isTransactionLinkedToDocument(txGuid)) {
      setError({
        code: "VALIDATION_ERROR",
        message: "lançamentos de faturamentos/compras devem ser excluídos nas telas de Faturamentos/Compras",
        details: {}
      });
      return;
    }

    const confirmed = window.confirm("Deseja excluir este lançamento do razão?");
    if (!confirmed) return;

    setError(null);
    setDeletingTxGuid(txGuid);
    const res = await api.del(`/transactions/${txGuid}`);
    setDeletingTxGuid("");

    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (editingTxGuid === txGuid) {
      setEditingTxGuid("");
      setSavingTxGuid("");
    }
    await loadTransactions(activeBookId);
  };

  const openSourceDocument = (source) => {
    if (!source?.documentGuid) return;
    if (source.sourceType === "invoicing") {
      onOpenInvoicing({
        invoiceGuid: source.documentGuid,
        invoiceId: source.documentId || ""
      });
      return;
    }
    if (source.sourceType === "billing") {
      onOpenBilling({
        billGuid: source.documentGuid,
        billId: source.documentId || ""
      });
    }
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Razão</h2>
          <div className="small-muted">Razão da conta com lançamento direto.</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => refreshLedgerData(activeBookId, true)}
            disabled={!activeBookId || refreshing}
          >
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
          {returnToInvoice || returnToBilling ? (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => onReturnToTab(returnTab)}
            >
              {returnToInvoice
                ? "Voltar para Faturamento"
                : "Voltar para Compras/Cobrança"}
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

      <div className="row g-3 mb-4 align-items-end">
        <div className="col-md-6">
          <label className="form-label">Conta do razão</label>
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
                  placeholder="Filtrar conta do razão"
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
        <div className="col-auto">
          <label className="form-label">Data inicial</label>
          <input
            type="date"
            className="form-control"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            disabled={!activeBookId}
          />
        </div>
        <div className="col-auto">
          <label className="form-label">Data final</label>
          <input
            type="date"
            className="form-control"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            disabled={!activeBookId}
          />
        </div>
        {(filterDateFrom || filterDateTo) && (
          <div className="col-auto">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
            >
              Limpar filtro
            </button>
          </div>
        )}
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

      <div className="table-responsive mb-3">
        <table className="table table-sm align-middle ledger-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Histórico</th>
              <th>Contra-partida</th>
              <th className="text-end">{debitHeaderLabel}</th>
              <th className="text-end">{creditHeaderLabel}</th>
              <th className="text-end">Saldo</th>
              <th>Origem</th>
              <th className="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            {totalItems === 0 ? (
              <tr>
                <td colSpan={8} className="small-muted">
                  Nenhum lançamento para a conta selecionada.
                </td>
              </tr>
            ) : (
              pagedLedgerRows.map((row) => {
                const isRowEditing = editingTxGuid === row.txGuid;
                const isRowSaving = savingTxGuid === row.txGuid;
                const canEditContext = Boolean(getEditableTransactionContext(row.txGuid));
                const source = sourceByTxGuid[row.txGuid] || null;
                const isSourceLinked = Boolean(source);
                const canEdit = canEditContext && !isSourceLinked;
                const canDelete = !isSourceLinked;
                const sourceLabel = source
                  ? source.sourceType === "invoicing"
                    ? `Faturamento #${source.documentId}${source.relation === "payment" ? " (pagamento)" : ""}`
                    : `Cobrança #${source.documentId}${source.relation === "payment" ? " (pagamento)" : ""}`
                  : "-";
                return (
                  <tr key={row.key}>
                    <td>{formatDate(row.date)}</td>
                    <td>{row.history}</td>
                    <td>
                      {row.contraAccounts.length > 0 ? (
                        row.contraAccounts.map((contraAccount, index) => (
                          <React.Fragment key={`${row.key}:${contraAccount.accountId}:${index}`}>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 align-baseline"
                              onClick={() => selectLedgerAccount(contraAccount.accountId)}
                              title={`Abrir razão da conta ${contraAccount.label}`}
                            >
                              {contraAccount.label}
                            </button>
                            {index < row.contraAccounts.length - 1 ? ", " : ""}
                          </React.Fragment>
                        ))
                      ) : (
                        row.contra
                      )}
                    </td>
                    <td className="text-end">{row.debit ? formatAmount(row.debit, ledgerCommodity?.mnemonic) : "-"}</td>
                    <td className="text-end">{row.credit ? formatAmount(row.credit, ledgerCommodity?.mnemonic) : "-"}</td>
                    <td className="text-end fw-semibold">{formatAmount(row.balance, ledgerCommodity?.mnemonic)}</td>
                    <td>
                      {source ? (
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 align-baseline"
                          onClick={() => openSourceDocument(source)}
                        >
                          {sourceLabel}
                        </button>
                      ) : (
                        <span className="small-muted">-</span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <button
                          type="button"
                          className={`btn btn-sm ${isRowEditing ? "btn-secondary" : "btn-outline-secondary"}`}
                          onClick={() => startEditingLedgerEntry(row.txGuid)}
                          disabled={!canEdit || isRowSaving || deletingTxGuid === row.txGuid}
                          title={
                            isSourceLinked
                              ? "Edite este lançamento em Faturamentos/Compras"
                              : canEdit
                              ? "Editar lançamento"
                              : "Somente lançamentos com uma única contra-partida podem ser editados"
                          }
                        >
                          {isRowEditing ? "Editando" : "Editar"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteLedgerEntry(row.txGuid)}
                          disabled={!canDelete || deletingTxGuid === row.txGuid || isRowSaving}
                          title={
                            isSourceLinked
                              ? "Exclua este lançamento em Faturamentos/Compras"
                              : "Excluir lançamento"
                          }
                        >
                          {deletingTxGuid === row.txGuid ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="d-flex align-items-center justify-content-between mt-3 mb-3 flex-wrap gap-2">
        <div className="small-muted">Mostrando {pagedLedgerRows.length} de {totalItems} lançamentos</div>
        <div className="d-flex align-items-center gap-2">
          <label className="form-label mb-0 small-muted">Ordem</label>
          <select
            className="form-select form-select-sm"
            value={chronologicalOrder}
            onChange={(event) => {
              setChronologicalOrder(event.target.value);
              setPage(1);
            }}
            disabled={!activeBookId}
            style={{ width: "180px" }}
          >
            <option value="desc">Mais recentes primeiro</option>
            <option value="asc">Mais antigos primeiro</option>
          </select>
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
            disabled={!activeBookId || currentPage <= 1}
          >
            Primeira
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={!activeBookId || currentPage <= 1}
          >
            Anterior
          </button>
          <span className="small-muted">
            Página {totalItems === 0 ? 0 : currentPage} de {totalItems === 0 ? 0 : totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={!activeBookId || currentPage >= totalPages || totalItems === 0}
          >
            Próxima
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setPage(totalPages)}
            disabled={!activeBookId || currentPage >= totalPages || totalItems === 0}
          >
            Última
          </button>
        </div>
      </div>

      {editingTxGuid ? (
        <div className="alert alert-info py-2">
          Modo de edição ativo. Ajuste os campos abaixo e clique em salvar.
        </div>
      ) : null}

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
          <label className="form-label">Histórico</label>
          <input
            className="form-control"
            value={ledgerForm.description}
            onChange={(event) => setLedgerForm({ ...ledgerForm, description: event.target.value })}
            placeholder="Descrição do lançamento"
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
          <label className="form-label">Conta de contra-partida (árvore)</label>
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
        <div className="col-md-12 mt-2 d-flex justify-content-end gap-2">
          {editingTxGuid ? (
            <button className="btn btn-outline-secondary" type="button" onClick={cancelEditingLedgerEntry}>
              Cancelar edição
            </button>
          ) : null}
          <button
            className="btn btn-accent"
            type="submit"
            disabled={!activeBookId || (Boolean(editingTxGuid) && savingTxGuid === editingTxGuid)}
          >
            {editingTxGuid ? (savingTxGuid === editingTxGuid ? "Salvando..." : "Salvar alterações") : "Lançar no Razão"}
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
