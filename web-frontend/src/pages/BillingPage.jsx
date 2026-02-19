import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDecimal(input, fractionDigits = null) {
  const raw = String(input ?? "").trim();
  if (!raw) return Number.NaN;

  const compact = raw.replace(/\s+/g, "");
  const commaCount = (compact.match(/,/g) || []).length;
  const dotCount = (compact.match(/\./g) || []).length;
  const commaIndex = compact.lastIndexOf(",");
  const dotIndex = compact.lastIndexOf(".");
  const hasComma = commaIndex >= 0;
  const hasDot = dotIndex >= 0;

  let decimalIndex = -1;
  if (hasComma && hasDot) {
    decimalIndex = Math.max(commaIndex, dotIndex);
  } else if (hasComma) {
    if (
      fractionDigits !== null &&
      commaCount === 1 &&
      compact.slice(commaIndex + 1).replace(/[^\d]/g, "").length > fractionDigits
    ) {
      decimalIndex = -1;
    } else {
      decimalIndex = commaIndex;
    }
  } else if (hasDot) {
    if (
      dotCount > 1 ||
      (
        fractionDigits !== null &&
        dotCount === 1 &&
        compact.slice(dotIndex + 1).replace(/[^\d]/g, "").length > fractionDigits
      )
    ) {
      decimalIndex = -1;
    } else {
      decimalIndex = dotIndex;
    }
  }

  const sign = compact.startsWith("-") ? "-" : "";
  const integerChunk = decimalIndex >= 0 ? compact.slice(0, decimalIndex) : compact;
  const decimalChunk = decimalIndex >= 0 ? compact.slice(decimalIndex + 1) : "";

  const integerDigits = integerChunk.replace(/[^\d]/g, "");
  const decimalDigits = decimalChunk.replace(/[^\d]/g, "");
  if (!integerDigits && !decimalDigits) return Number.NaN;

  const normalized = decimalIndex >= 0
    ? `${sign}${integerDigits || "0"}.${decimalDigits}`
    : `${sign}${integerDigits}`;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : Number.NaN;
}

function decimalToRational(input, scale = 100) {
  const guessedFractionDigits = Number.isInteger(Math.log10(scale)) ? Math.log10(scale) : null;
  const value = parseDecimal(input, guessedFractionDigits);
  if (!Number.isFinite(value)) return null;
  return {
    num: Math.round(value * scale),
    denom: scale
  };
}

function decimalString(value, precision = 2) {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision
  }).format(value);
}

function decimalFixedString(value, precision = 2) {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  }).format(value);
}

function formatDecimalInput(input, precision = 2, fixed = false) {
  const value = parseDecimal(input, precision);
  if (!Number.isFinite(value)) return String(input ?? "");
  return fixed ? decimalFixedString(value, precision) : decimalString(value, precision);
}

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

function invoiceStatusLabel(status) {
  if (status === "PAID") return "Paga";
  if (status === "PARTIAL") return "Parcial";
  if (status === "UNPAID") return "Não paga";
  if (status === "POSTED") return "Postada";
  if (status === "VOID") return "Cancelada";
  return status || "-";
}

function invoiceDateInput(value) {
  if (!value) return "";
  const ymd = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function nextInvoiceId(invoices) {
  const numericIds = invoices
    .map((invoice) => Number.parseInt(String(invoice.id || ""), 10))
    .filter((value) => Number.isFinite(value));
  const next = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  return String(next).padStart(6, "0");
}

function defaultEntryForm(incomeAccountGuid = "") {
  return {
    date: todayIsoDate(),
    description: "",
    action: "",
    notes: "",
    income_account_guid: incomeAccountGuid,
    quantity: "1",
    unit_price: "0",
    discount: "0",
    discount_type: "PERCENT",
    discount_how: "PRETAX",
    taxable: false,
    tax_included: false
  };
}

function defaultPaymentForm(transferAccountGuid = "", amount = "") {
  return {
    transfer_account_guid: transferAccountGuid,
    amount,
    payment_date: todayIsoDate(),
    memo: ""
  };
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

function keepTypeBranches(nodes, allowedTypes) {
  const visit = (node) => {
    const children = (node.children || []).map(visit).filter(Boolean);
    if (node.type === "ROOT") {
      return children.length > 0 ? { ...node, children } : null;
    }
    if (allowedTypes.has(node.type) || children.length > 0) {
      return { ...node, children };
    }
    return null;
  };

  return nodes.map(visit).filter(Boolean);
}

function reverseAccountPath(path) {
  const parts = String(path || "")
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return String(path || "");
  return parts.reverse().join(" / ");
}

export default function BillingPage({
  initialBillGuid = "",
  onOpenBillingList = null,
  onOpenBillTab = null,
  onBillDeleted = null,
  initialPostingAccountGuid = "",
  openCreateOnMount = false,
  onCreateMountHandled = null
}) {
  const [commodities, setCommodities] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountTree, setAccountTree] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceGuid, setSelectedInvoiceGuid] = useState("");
  const [editingEntryGuid, setEditingEntryGuid] = useState("");
  const [entryForm, setEntryForm] = useState(defaultEntryForm());
  const [incomePickerOpen, setIncomePickerOpen] = useState(false);
  const [incomeSearch, setIncomeSearch] = useState("");
  const [postingAccountGuid, setPostingAccountGuid] = useState("");
  const [postingDate, setPostingDate] = useState(todayIsoDate());
  const [postingPickerOpen, setPostingPickerOpen] = useState(false);
  const [postingSearch, setPostingSearch] = useState("");
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm());
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [duplicatingBill, setDuplicatingBill] = useState(false);
  const [error, setError] = useState(null);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: "INVOICE",
    id: "000001",
    date_opened: todayIsoDate(),
    vendor_guid: "",
    billing_id: "",
    terms: "",
    notes: ""
  });

  const commoditiesById = useMemo(
    () => new Map(commodities.map((commodity) => [commodity.id, commodity])),
    [commodities]
  );
  const vendorsById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.guid, vendor])),
    [vendors]
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
      if (account.type === "ROOT" || !account.parent_id) {
        cache.set(accountId, account.name);
        return account.name;
      }

      const parent = accountsById.get(account.parent_id);
      if (!parent) {
        cache.set(accountId, account.name);
        return account.name;
      }

      const parentName = build(account.parent_id, visited);
      const fullName =
        parent.type === "ROOT"
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
  const postingAccounts = useMemo(
    () => accounts.filter((account) => account.type === "LIABILITY"),
    [accounts]
  );
  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.guid === selectedInvoiceGuid) || null,
    [invoices, selectedInvoiceGuid]
  );
  const selectedInvoiceVendor = selectedInvoice
    ? vendorsById.get(selectedInvoice.vendor_guid) || null
    : null;
  const isInvoicePosted = Boolean(selectedInvoice?.date_posted);
  const selectedInvoiceMnemonic = selectedInvoice
    ? commoditiesById.get(selectedInvoice.currency_guid)?.mnemonic || ""
    : "";
  const selectedInvoiceOpenAmount = selectedInvoice
    ? Math.abs(rationalToNumber(selectedInvoice.open_amount_num, selectedInvoice.open_amount_denom))
    : 0;
  const selectedIncomeAccount = accountsById.get(entryForm.income_account_guid) || null;
  const selectedPostingAccount = accountsById.get(postingAccountGuid) || null;
  const selectedPaymentAccount = accountsById.get(paymentForm.transfer_account_guid) || null;
  const selectedIncomeAccountPath = selectedIncomeAccount
    ? accountFullNameById.get(selectedIncomeAccount.id) || selectedIncomeAccount.name
    : "";
  const incomeAccountLabel = selectedIncomeAccount
    ? `${reverseAccountPath(selectedIncomeAccountPath)} (${selectedIncomeAccount.type})`
    : "Selecione a conta de despesa";
  const postingAccountLabel = selectedPostingAccount
    ? `${accountFullNameById.get(selectedPostingAccount.id) || selectedPostingAccount.name} (${selectedPostingAccount.type})`
    : "Selecione a conta de postagem";
  const paymentAccountLabel = selectedPaymentAccount
    ? `${accountFullNameById.get(selectedPaymentAccount.id) || selectedPaymentAccount.name} (${selectedPaymentAccount.type})`
    : "Selecione a conta de pagamento";
  const incomeTree = useMemo(
    () => keepTypeBranches(accountTree, new Set(["EXPENSE"])),
    [accountTree]
  );
  const postingTree = useMemo(
    () => keepTypeBranches(accountTree, new Set(["LIABILITY"])),
    [accountTree]
  );
  const visibleIncomeTree = useMemo(
    () => filterTree(incomeTree, incomeSearch),
    [incomeTree, incomeSearch]
  );
  const visiblePostingTree = useMemo(
    () => filterTree(postingTree, postingSearch),
    [postingTree, postingSearch]
  );
  const paymentTree = useMemo(() => accountTree, [accountTree]);
  const visiblePaymentTree = useMemo(
    () => filterTree(paymentTree, paymentSearch),
    [paymentTree, paymentSearch]
  );

  const resolveBookDefaultPostingAccountGuid = (accountList = accounts) => {
    const defaultGuid = activeBook?.default_payables_account_guid || "";
    if (!defaultGuid) return "";
    const account = accountList.find((item) => item.id === defaultGuid);
    if (!account || account.type !== "LIABILITY" || account.is_placeholder) return "";
    return account.id;
  };

  const resolveVendorDefaultExpenseAccountGuid = (vendorGuid, accountList = accounts) => {
    if (!vendorGuid) return "";
    const vendor = vendorsById.get(vendorGuid);
    const accountGuid = vendor?.expense_account_guid || "";
    if (!accountGuid) return "";
    const account = accountList.find((item) => item.id === accountGuid);
    if (!account || account.type !== "EXPENSE" || account.is_placeholder) return "";
    return account.id;
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
    const response = await api.get(`/vendors?book_id=${bookId}`);
    if (!response.ok) {
      setError(response.error);
      return [];
    }
    setVendors(response.data);
    return response.data;
  };

  const loadAccounts = async (bookId) => {
    const response = await api.get(`/accounts?book_id=${bookId}`);
    if (!response.ok) {
      setError(response.error);
      return [];
    }
    const nonRoot = response.data.filter((account) => account.type !== "ROOT");
    setAccounts(nonRoot);
    return nonRoot;
  };

  const loadAccountTree = async (bookId) => {
    const response = await api.get(`/accounts/tree?book_id=${bookId}`);
    if (!response.ok) {
      setError(response.error);
      return [];
    }
    setAccountTree(response.data);
    return response.data;
  };

  const loadInvoices = async (
    bookId,
    preferredGuid = "",
    {
      preserveCurrentSelection = true,
      fallbackToFirstSelection = true
    } = {}
  ) => {
    const response = await api.get(`/bills?book_id=${bookId}`);
    if (!response.ok) {
      setError(response.error);
      return [];
    }
    setError(null);
    setInvoices(response.data);
    setSelectedInvoiceGuid((current) => {
      const preferred = preferredGuid && response.data.some((item) => item.guid === preferredGuid)
        ? preferredGuid
        : "";
      if (preferred) return preferred;
      if (preserveCurrentSelection && current && response.data.some((item) => item.guid === current)) return current;
      if (fallbackToFirstSelection) {
        return response.data.length > 0 ? response.data[0].guid : "";
      }
      return "";
    });
    return response.data;
  };

  const loadBookData = async (bookId, preferredGuid = "", invoiceSelectionOptions) => {
    if (!bookId) return;
    const [loadedVendors, loadedAccounts, loadedInvoices] = await Promise.all([
      loadVendors(bookId),
      loadAccounts(bookId),
      loadInvoices(bookId, preferredGuid, invoiceSelectionOptions),
      loadAccountTree(bookId)
    ]);
    const defaultVendor = loadedVendors[0]?.guid || "";
    const defaultPosting =
      resolveBookDefaultPostingAccountGuid(loadedAccounts) ||
      loadedAccounts.find((account) => account.type === "LIABILITY" && !account.is_placeholder)?.id ||
      "";
    setCreateForm((current) => ({
      ...current,
      vendor_guid: current.vendor_guid && loadedVendors.some((vendor) => vendor.guid === current.vendor_guid)
        ? current.vendor_guid
        : defaultVendor,
      id: loadedInvoices.length > 0 ? nextInvoiceId(loadedInvoices) : "000001"
    }));
    setEntryForm((current) => ({
      ...current,
      income_account_guid:
        current.income_account_guid &&
        loadedAccounts.some((account) => account.id === current.income_account_guid)
          ? current.income_account_guid
          : ""
    }));
    setPostingAccountGuid((current) =>
      current &&
      loadedAccounts.some(
        (account) => account.id === current && account.type === "LIABILITY" && !account.is_placeholder
      )
        ? current
        : defaultPosting
    );
  };

  useEffect(() => {
    loadCommodities();
  }, []);

  useEffect(() => {
    if (!activeBookId) return;
    const createMode = !initialBillGuid;
    if (createMode) {
      setSelectedInvoiceGuid("");
      setEntryForm(defaultEntryForm());
    }
    loadBookData(
      activeBookId,
      initialBillGuid || "",
      createMode
        ? {
            preserveCurrentSelection: false,
            fallbackToFirstSelection: false
          }
        : undefined
    );
    setEditingEntryGuid("");
  }, [activeBookId, initialBillGuid]);

  useEffect(() => {
    if (!selectedInvoiceGuid) {
      setEditingEntryGuid("");
      setEntryForm(defaultEntryForm());
    }
  }, [selectedInvoiceGuid]);

  useEffect(() => {
    if (!selectedInvoice) {
      setPostingDate(todayIsoDate());
      return;
    }
    const resolvedPostingDate =
      invoiceDateInput(selectedInvoice.date_posted) ||
      invoiceDateInput(selectedInvoice.date_opened) ||
      todayIsoDate();
    setPostingDate(resolvedPostingDate);
  }, [selectedInvoice?.guid, selectedInvoice?.date_posted, selectedInvoice?.date_opened]);

  useEffect(() => {
    if (!selectedInvoice || editingEntryGuid) return;
    const defaultExpenseAccountGuid = resolveVendorDefaultExpenseAccountGuid(selectedInvoice.vendor_guid);
    if (!defaultExpenseAccountGuid) return;
    setEntryForm((current) => {
      if (current.income_account_guid) return current;
      return { ...current, income_account_guid: defaultExpenseAccountGuid };
    });
  }, [selectedInvoice, editingEntryGuid, accounts, vendorsById]);

  useEffect(() => {
    if (!selectedInvoice) return;
    if (
      selectedInvoice.post_account_guid &&
      postingAccounts.some(
        (account) => account.id === selectedInvoice.post_account_guid && !account.is_placeholder
      )
    ) {
      setPostingAccountGuid(selectedInvoice.post_account_guid);
      return;
    }
    if (
      initialPostingAccountGuid &&
      postingAccounts.some((account) => account.id === initialPostingAccountGuid && !account.is_placeholder)
    ) {
      setPostingAccountGuid(initialPostingAccountGuid);
      return;
    }
    const defaultPosting = resolveBookDefaultPostingAccountGuid(postingAccounts);
    if (defaultPosting) {
      setPostingAccountGuid(defaultPosting);
    }
  }, [selectedInvoice, postingAccounts, initialPostingAccountGuid]);

  useEffect(() => {
    if (!selectedInvoice) {
      setPaymentForm(defaultPaymentForm());
      return;
    }

    const suggestedAmount =
      isInvoicePosted && selectedInvoiceOpenAmount > 0
        ? decimalFixedString(selectedInvoiceOpenAmount, 2)
        : "";

    setPaymentForm((current) => ({
      ...current,
      transfer_account_guid: "",
      amount: suggestedAmount,
      payment_date: current.payment_date || todayIsoDate()
    }));
  }, [
    selectedInvoiceGuid,
    selectedInvoice?.post_account_guid,
    selectedInvoice?.date_posted,
    selectedInvoice?.open_amount_num,
    selectedInvoice?.open_amount_denom,
    accounts,
    isInvoicePosted,
    selectedInvoiceOpenAmount
  ]);

  useEffect(() => {
    setIncomePickerOpen(false);
    setIncomeSearch("");
    setPostingPickerOpen(false);
    setPostingSearch("");
    setPaymentPickerOpen(false);
    setPaymentSearch("");
  }, [selectedInvoiceGuid, editingEntryGuid, accountTree]);

  const selectIncomeAccount = (accountId) => {
    setEntryForm((current) => ({ ...current, income_account_guid: accountId }));
    setIncomeSearch("");
    setIncomePickerOpen(false);
  };

  const toggleIncomePicker = () => {
    setIncomePickerOpen((current) => {
      const next = !current;
      if (next) setIncomeSearch("");
      return next;
    });
  };

  const renderIncomeTreeNodes = (nodes, depth = 0) => {
    return nodes.map((node) => {
      if (node.type === "ROOT") {
        return (
          <div key={node.id}>
            {node.children && node.children.length > 0
              ? renderIncomeTreeNodes(node.children, depth)
              : null}
          </div>
        );
      }

      const selected = entryForm.income_account_guid === node.id;
      const selectable = node.type === "EXPENSE";

      return (
        <div key={node.id}>
          <button
            type="button"
            className={`counter-tree-node ${selected ? "is-selected" : ""}`}
            style={{ marginLeft: `${depth * 14}px` }}
            disabled={!selectable}
            onClick={() => {
              if (selectable) selectIncomeAccount(node.id);
            }}
          >
            <span className="counter-tree-name">{node.name}</span>
            <span className="badge badge-soft text-uppercase">{node.type}</span>
          </button>
          {node.children && node.children.length > 0
            ? renderIncomeTreeNodes(node.children, depth + 1)
            : null}
        </div>
      );
    });
  };

  const selectPostingAccount = (accountId) => {
    setPostingAccountGuid(accountId);
    setPostingSearch("");
    setPostingPickerOpen(false);
  };

  const togglePostingPicker = () => {
    setPostingPickerOpen((current) => {
      const next = !current;
      if (next) setPostingSearch("");
      return next;
    });
  };

  const renderPostingTreeNodes = (nodes, depth = 0) => {
    return nodes.map((node) => {
      if (node.type === "ROOT") {
        return (
          <div key={node.id}>
            {node.children && node.children.length > 0
              ? renderPostingTreeNodes(node.children, depth)
              : null}
          </div>
        );
      }

      const selected = postingAccountGuid === node.id;
      const selectable = node.type === "LIABILITY" && !node.is_placeholder;

      return (
        <div key={node.id}>
          <button
            type="button"
            className={`counter-tree-node ${selected ? "is-selected" : ""}`}
            style={{ marginLeft: `${depth * 14}px` }}
            disabled={!selectable}
            onClick={() => {
              if (selectable) selectPostingAccount(node.id);
            }}
          >
            <span className="counter-tree-name">{node.name}</span>
            <span className="badge badge-soft text-uppercase">{node.type}</span>
          </button>
          {node.children && node.children.length > 0
            ? renderPostingTreeNodes(node.children, depth + 1)
            : null}
        </div>
      );
    });
  };

  const selectPaymentAccount = (accountId) => {
    setPaymentForm((current) => ({ ...current, transfer_account_guid: accountId }));
    setPaymentSearch("");
    setPaymentPickerOpen(false);
  };

  const togglePaymentPicker = () => {
    setPaymentPickerOpen((current) => {
      const next = !current;
      if (next) setPaymentSearch("");
      return next;
    });
  };

  const renderPaymentTreeNodes = (nodes, depth = 0) => {
    return nodes.map((node) => {
      if (node.type === "ROOT") {
        return (
          <div key={node.id}>
            {node.children && node.children.length > 0
              ? renderPaymentTreeNodes(node.children, depth)
              : null}
          </div>
        );
      }

      const selected = paymentForm.transfer_account_guid === node.id;
      const selectable =
        !node.is_placeholder &&
        node.id !== selectedInvoice?.post_account_guid;

      return (
        <div key={node.id}>
          <button
            type="button"
            className={`counter-tree-node ${selected ? "is-selected" : ""}`}
            style={{ marginLeft: `${depth * 14}px` }}
            disabled={!selectable}
            onClick={() => {
              if (selectable) selectPaymentAccount(node.id);
            }}
          >
            <span className="counter-tree-name">{node.name}</span>
            <span className="badge badge-soft text-uppercase">{node.type}</span>
            {node.is_placeholder ? <span className="small-muted">marcador</span> : null}
          </button>
          {node.children && node.children.length > 0
            ? renderPaymentTreeNodes(node.children, depth + 1)
            : null}
        </div>
      );
    });
  };

  const postSelectedInvoice = async () => {
    if (!selectedInvoice) return;
    if (!postingAccountGuid) {
      setError({ code: "VALIDATION_ERROR", message: "Selecione a conta de postagem", details: {} });
      return;
    }
    const resolvedPostingDate =
      postingDate || invoiceDateInput(selectedInvoice.date_opened) || todayIsoDate();

    const response = await api.post(`/bills/${selectedInvoice.guid}/post`, {
      post_account_guid: postingAccountGuid,
      post_date: `${resolvedPostingDate}T00:00:00Z`
    });
    if (!response.ok) {
      setError(response.error);
      return;
    }

    await loadBookData(activeBookId, selectedInvoice.guid);
  };

  const unpostSelectedInvoice = async () => {
    if (!selectedInvoice) return;

    const response = await api.post(`/bills/${selectedInvoice.guid}/unpost`, {});
    if (!response.ok) {
      setError(response.error);
      return;
    }

    await loadBookData(activeBookId, selectedInvoice.guid);
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    if (!selectedInvoice || !isInvoicePosted) return;
    if (!paymentForm.transfer_account_guid) {
      setError({ code: "VALIDATION_ERROR", message: "Selecione a conta de pagamento", details: {} });
      return;
    }

    const amount = decimalToRational(paymentForm.amount, 100);
    if (!amount || amount.num <= 0 || amount.denom <= 0) {
      setError({ code: "VALIDATION_ERROR", message: "Valor de pagamento inválido", details: {} });
      return;
    }

    const payload = {
      transfer_account_guid: paymentForm.transfer_account_guid,
      amount_num: amount.num,
      amount_denom: amount.denom,
      payment_date: paymentForm.payment_date ? `${paymentForm.payment_date}T00:00:00Z` : null,
      memo: paymentForm.memo.trim() || null
    };

    const response = await api.post(`/bills/${selectedInvoice.guid}/payments`, payload);
    if (!response.ok) {
      setError(response.error);
      return;
    }

    setPaymentForm((current) => ({ ...current, memo: "" }));
    await loadBookData(activeBookId, selectedInvoice.guid);
  };

  const undoPayment = async (paymentTxGuid) => {
    if (!selectedInvoice) return;

    const response = await api.post(`/bills/${selectedInvoice.guid}/payments/${paymentTxGuid}/undo`, {});
    if (!response.ok) {
      setError(response.error);
      return;
    }

    await loadBookData(activeBookId, selectedInvoice.guid);
  };

  const openCreateDialog = () => {
    setCreateOpen(true);
    setCreateForm((current) => ({
      ...current,
      type: "INVOICE",
      id: nextInvoiceId(invoices),
      date_opened: todayIsoDate(),
      vendor_guid: current.vendor_guid || vendors[0]?.guid || "",
      billing_id: "",
      terms: "",
      notes: ""
    }));
  };

  useEffect(() => {
    if (!openCreateOnMount) return;
    openCreateDialog();
    if (typeof onCreateMountHandled === "function") {
      onCreateMountHandled();
    }
  }, [openCreateOnMount, onCreateMountHandled]);

  const closeCreateDialog = () => {
    setCreateOpen(false);
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    if (!activeBookId) return;
    if (!createForm.vendor_guid) {
      setError({ code: "VALIDATION_ERROR", message: "Selecione um fornecedor", details: {} });
      return;
    }

    const vendor = vendorsById.get(createForm.vendor_guid);
    const payload = {
      book_id: activeBookId,
      type: createForm.type,
      id: createForm.id.trim() || nextInvoiceId(invoices),
      date_opened: createForm.date_opened ? `${createForm.date_opened}T00:00:00Z` : null,
      notes: createForm.notes || "",
      currency_guid: vendor?.currency_guid || commodities[0]?.id || "",
      vendor_guid: createForm.vendor_guid,
      billing_id: createForm.billing_id.trim() || null,
      terms: createForm.terms.trim() || null
    };

    const response = await api.post("/bills", payload);
    if (!response.ok) {
      setError(response.error);
      return;
    }

    setCreateOpen(false);
    await loadBookData(activeBookId, response.data.guid);
  };

  const submitInvoicePatch = async (event) => {
    event.preventDefault();
    if (!selectedInvoice) return;

    const payload = isInvoicePosted
      ? {
          notes: selectedInvoice.notes || "",
          active: Boolean(selectedInvoice.active)
        }
      : {
          type: selectedInvoice.type,
          id: selectedInvoice.id,
          date_opened: selectedInvoice.date_opened || null,
          notes: selectedInvoice.notes || "",
          active: Boolean(selectedInvoice.active),
          currency_guid: selectedInvoice.currency_guid,
          vendor_guid: selectedInvoice.vendor_guid,
          billing_id: selectedInvoice.billing_id || null,
          terms: selectedInvoice.terms || null
        };

    const response = await api.patch(`/bills/${selectedInvoice.guid}`, payload);
    if (!response.ok) {
      setError(response.error);
      return;
    }

    await loadBookData(activeBookId, selectedInvoice.guid);
  };

  const removeInvoice = async (invoiceGuid) => {
    const confirmed = window.confirm("Tem certeza que deseja excluir esta compra?");
    if (!confirmed) return;

    const response = await api.del(`/bills/${invoiceGuid}`);
    if (!response.ok) {
      setError(response.error);
      return;
    }

    if (typeof onBillDeleted === "function") {
      onBillDeleted(invoiceGuid);
      return;
    }

    setEditingEntryGuid("");
    setEntryForm(defaultEntryForm());
    await loadBookData(activeBookId);
  };

  const duplicateBill = async () => {
    if (!selectedInvoice || !activeBookId || duplicatingBill) return;

    setError(null);
    setDuplicatingBill(true);

    const today = todayIsoDate();
    const sourcePostingAccountGuid = selectedInvoice.post_account_guid || postingAccountGuid || "";
    const sourceEntries = Array.isArray(selectedInvoice.entries) ? selectedInvoice.entries : [];

    const createPayload = {
      book_id: activeBookId,
      type: selectedInvoice.type,
      id: "",
      date_opened: `${today}T00:00:00Z`,
      notes: selectedInvoice.notes || "",
      active: Boolean(selectedInvoice.active),
      currency_guid: selectedInvoice.currency_guid,
      vendor_guid: selectedInvoice.vendor_guid,
      billing_id: selectedInvoice.billing_id || null,
      terms: selectedInvoice.terms || null
    };

    let duplicatedGuid = "";
    try {
      const created = await api.post("/bills", createPayload);
      if (!created.ok) {
        setError(created.error);
        return;
      }
      duplicatedGuid = created.data.guid;

      for (const entry of sourceEntries) {
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
          tax_included: Boolean(entry.tax_included),
          tax_table_guid: entry.tax_table_guid || null
        };

        const createdEntry = await api.post(`/bills/${duplicatedGuid}/entries`, entryPayload);
        if (!createdEntry.ok) {
          if (duplicatedGuid) {
            await api.del(`/bills/${duplicatedGuid}`);
          }
          setError(createdEntry.error);
          return;
        }
      }

      if (typeof onOpenBillTab === "function") {
        onOpenBillTab({
          billGuid: duplicatedGuid,
          billId: created.data?.id || createPayload.id || "",
          tabLabel: "Nova Cobrança",
          initialPostingAccountGuid: sourcePostingAccountGuid
        });
        return;
      }

      await loadBookData(activeBookId, duplicatedGuid);
      if (sourcePostingAccountGuid) {
        setPostingAccountGuid(sourcePostingAccountGuid);
      }
    } finally {
      setDuplicatingBill(false);
    }
  };

  const resetEntryEditor = () => {
    setEditingEntryGuid("");
    setEntryForm(defaultEntryForm(resolveVendorDefaultExpenseAccountGuid(selectedInvoice?.vendor_guid || "")));
  };

  const startEditEntry = (entry) => {
    const discountType = entry.discount_type || "PERCENT";
    const discountValue = discountType === "VALUE"
      ? rationalToNumber(entry.discount_num, entry.discount_denom)
      : rationalToNumber(entry.discount_num, entry.discount_denom) * 100;
    setEditingEntryGuid(entry.guid);
    setEntryForm({
      date: invoiceDateInput(entry.date) || todayIsoDate(),
      description: entry.description || "",
      action: entry.action || "",
      notes: entry.notes || "",
      income_account_guid: entry.income_account_guid || "",
      quantity: decimalString(rationalToNumber(entry.quantity_num, entry.quantity_denom), 3),
      unit_price: decimalFixedString(rationalToNumber(entry.unit_price_num, entry.unit_price_denom), 2),
      discount: discountType === "VALUE" ? decimalFixedString(discountValue, 2) : decimalString(discountValue, 2),
      discount_type: discountType,
      discount_how: entry.discount_how || "PRETAX",
      taxable: Boolean(entry.taxable),
      tax_included: Boolean(entry.tax_included)
    });
  };

  const removeEntry = async (entryGuid) => {
    if (!selectedInvoice) return;
    const response = await api.del(`/bills/${selectedInvoice.guid}/entries/${entryGuid}`);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    if (editingEntryGuid === entryGuid) {
      resetEntryEditor();
    }
    await loadBookData(activeBookId, selectedInvoice.guid);
  };

  const submitEntry = async (event) => {
    event.preventDefault();
    if (!selectedInvoice) return;
    if (!entryForm.income_account_guid) {
      setError({ code: "VALIDATION_ERROR", message: "Selecione a conta de despesa", details: {} });
      return;
    }

    const quantity = decimalToRational(entryForm.quantity, 1000);
    const unitPrice = decimalToRational(entryForm.unit_price, 100);
    if (!quantity || !unitPrice || quantity.denom <= 0 || unitPrice.denom <= 0) {
      setError({ code: "VALIDATION_ERROR", message: "Quantidade e preço devem ser numéricos", details: {} });
      return;
    }

    const discountValue = parseDecimal(entryForm.discount, 2);
    if (!Number.isFinite(discountValue)) {
      setError({ code: "VALIDATION_ERROR", message: "Desconto inválido", details: {} });
      return;
    }

    const discount =
      entryForm.discount_type === "VALUE"
        ? decimalToRational(entryForm.discount, 100)
        : {
            num: Math.round(discountValue * 100),
            denom: 10000
          };
    if (!discount) {
      setError({ code: "VALIDATION_ERROR", message: "Desconto inválido", details: {} });
      return;
    }

    const payload = {
      date: `${entryForm.date}T00:00:00Z`,
      description: entryForm.description.trim() || null,
      action: entryForm.action.trim() || null,
      notes: entryForm.notes.trim() || null,
      income_account_guid: entryForm.income_account_guid,
      quantity_num: quantity.num,
      quantity_denom: quantity.denom,
      unit_price_num: unitPrice.num,
      unit_price_denom: unitPrice.denom,
      discount_num: discount.num,
      discount_denom: discount.denom,
      discount_type: entryForm.discount_type,
      discount_how: entryForm.discount_how,
      taxable: Boolean(entryForm.taxable),
      tax_included: Boolean(entryForm.tax_included)
    };

    const response = editingEntryGuid
      ? await api.patch(`/bills/${selectedInvoice.guid}/entries/${editingEntryGuid}`, payload)
      : await api.post(`/bills/${selectedInvoice.guid}/entries`, payload);
    if (!response.ok) {
      setError(response.error);
      return;
    }

    resetEntryEditor();
    await loadBookData(activeBookId, selectedInvoice.guid);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Compra</h2>
          <div className="small-muted">Edição de compra, postagem, pagamentos e itens.</div>
        </div>
        <div className="d-flex gap-2">
          {typeof onOpenBillingList === "function" ? (
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onOpenBillingList}
              disabled={!activeBookId}
            >
              Lista de compras
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

      {createOpen ? (
        <div className="invoice-dialog mb-4">
          <h5 className="mb-3">Nova Compra</h5>
          <form onSubmit={submitCreate} className="row g-3">
            <div className="col-md-12">
              <div className="invoice-fieldset">
                <div className="invoice-fieldset-title">Informação da compra</div>
                <div className="row g-2">
                  <div className="col-md-12 d-flex align-items-center gap-3">
                    <label className="form-label mb-0">Tipo</label>
                    <label className="d-flex align-items-center gap-1">
                      <input
                        type="radio"
                        name="invoice_type"
                        checked={createForm.type === "INVOICE"}
                        onChange={() => setCreateForm((current) => ({ ...current, type: "INVOICE" }))}
                      />
                      Compra
                    </label>
                    <label className="d-flex align-items-center gap-1">
                      <input
                        type="radio"
                        name="invoice_type"
                        checked={createForm.type === "CREDIT_NOTE"}
                        onChange={() => setCreateForm((current) => ({ ...current, type: "CREDIT_NOTE" }))}
                      />
                      Nota de crédito
                    </label>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Número da compra</label>
                    <input
                      className="form-control"
                      value={createForm.id}
                      onChange={(event) => setCreateForm((current) => ({ ...current, id: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Data da abertura</label>
                    <input
                      type="date"
                      className="form-control"
                      value={createForm.date_opened}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, date_opened: event.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-12">
              <div className="invoice-fieldset">
                <div className="invoice-fieldset-title">Informações da cobrança</div>
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label">Fornecedor</label>
                    <select
                      className="form-select"
                      value={createForm.vendor_guid}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, vendor_guid: event.target.value }))
                      }
                      required
                    >
                      <option value="">Selecione...</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.guid} value={vendor.guid}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Trabalho</label>
                    <input className="form-control" disabled value="" placeholder="" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">ID da cobrança</label>
                    <input
                      className="form-control"
                      value={createForm.billing_id}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, billing_id: event.target.value }))
                      }
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Formas de pagamento</label>
                    <select
                      className="form-select"
                      value={createForm.terms || "None"}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          terms: event.target.value === "None" ? "" : event.target.value
                        }))
                      }
                    >
                      <option value="None">Nenhum</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-12">
              <label className="form-label">Notas</label>
              <textarea
                className="form-control"
                rows={3}
                value={createForm.notes}
                onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>

            <div className="col-md-12 d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={closeCreateDialog}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-accent">
                OK
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="invoice-layout">
        <div className="invoice-editor-panel">
          {selectedInvoice ? (
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h5 className="mb-0">Edite a compra - {selectedInvoice.id}</h5>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={duplicateBill}
                    disabled={!activeBookId || duplicatingBill}
                  >
                    {duplicatingBill ? "Duplicando..." : "Duplicar compra"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => removeInvoice(selectedInvoice.guid)}
                    disabled={isInvoicePosted}
                  >
                    Excluir compra
                  </button>
                </div>
              </div>

              <form onSubmit={submitInvoicePatch} className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label">Tipo</label>
                  <select
                    className="form-select"
                    value={selectedInvoice.type}
                    disabled={isInvoicePosted}
                    onChange={(event) =>
                      setInvoices((current) =>
                        current.map((invoice) =>
                          invoice.guid === selectedInvoice.guid
                            ? { ...invoice, type: event.target.value }
                            : invoice
                        )
                      )
                    }
                  >
                    <option value="INVOICE">Compra</option>
                    <option value="CREDIT_NOTE">Nota de crédito</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Número da compra</label>
                  <input
                    className="form-control"
                    value={selectedInvoice.id}
                    disabled={isInvoicePosted}
                    onChange={(event) =>
                      setInvoices((current) =>
                        current.map((invoice) =>
                          invoice.guid === selectedInvoice.guid
                            ? { ...invoice, id: event.target.value }
                            : invoice
                        )
                      )
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Data da abertura</label>
                  <input
                    type="date"
                    className="form-control"
                    value={invoiceDateInput(selectedInvoice.date_opened)}
                    disabled={isInvoicePosted}
                    onChange={(event) =>
                      setInvoices((current) =>
                        current.map((invoice) =>
                          invoice.guid === selectedInvoice.guid
                            ? {
                                ...invoice,
                                date_opened: event.target.value ? `${event.target.value}T00:00:00Z` : null
                              }
                            : invoice
                        )
                      )
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Fornecedor</label>
                  <select
                    className="form-select"
                    value={selectedInvoice.vendor_guid}
                    disabled={isInvoicePosted}
                    onChange={(event) => {
                      const vendorGuid = event.target.value;
                      setInvoices((current) =>
                        current.map((invoice) => {
                          if (invoice.guid !== selectedInvoice.guid) return invoice;
                          const vendor = vendorsById.get(vendorGuid);
                          return {
                            ...invoice,
                            vendor_guid: vendorGuid,
                            currency_guid: vendor?.currency_guid || invoice.currency_guid
                          };
                        })
                      );
                      if (!editingEntryGuid) {
                        const defaultExpenseAccountGuid = resolveVendorDefaultExpenseAccountGuid(vendorGuid);
                        if (!defaultExpenseAccountGuid) return;
                        setEntryForm((current) => (
                          current.income_account_guid
                            ? current
                            : { ...current, income_account_guid: defaultExpenseAccountGuid }
                        ));
                      }
                    }}
                  >
                    {vendors.map((vendor) => (
                      <option key={vendor.guid} value={vendor.guid}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">ID da cobrança</label>
                  <input
                    className="form-control"
                    value={selectedInvoice.billing_id || ""}
                    disabled={isInvoicePosted}
                    onChange={(event) =>
                      setInvoices((current) =>
                        current.map((invoice) =>
                          invoice.guid === selectedInvoice.guid
                            ? { ...invoice, billing_id: event.target.value }
                            : invoice
                        )
                      )
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Formas de pagamento</label>
                  <select
                    className="form-select"
                    value={selectedInvoice.terms || "None"}
                    disabled={isInvoicePosted}
                    onChange={(event) =>
                      setInvoices((current) =>
                        current.map((invoice) =>
                          invoice.guid === selectedInvoice.guid
                            ? { ...invoice, terms: event.target.value === "None" ? null : event.target.value }
                            : invoice
                        )
                      )
                    }
                  >
                    <option value="None">Nenhum</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Notas</label>
                  <input
                    className="form-control"
                    value={selectedInvoice.notes || ""}
                    onChange={(event) =>
                      setInvoices((current) =>
                        current.map((invoice) =>
                          invoice.guid === selectedInvoice.guid
                            ? { ...invoice, notes: event.target.value }
                            : invoice
                        )
                      )
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Conta de postagem (A/P)</label>
                  <div className="tree-select">
                    <button
                      type="button"
                      className="form-select tree-select-toggle"
                      onClick={togglePostingPicker}
                    >
                      <span className="tree-select-label">{postingAccountLabel}</span>
                      <span className="tree-select-caret">{postingPickerOpen ? "▲" : "▼"}</span>
                    </button>
                    {postingPickerOpen ? (
                      <div className="tree-select-menu">
                        <input
                          className="form-control mb-2"
                          value={postingSearch}
                          onChange={(event) => setPostingSearch(event.target.value)}
                          placeholder="Filtrar conta de postagem"
                        />
                        <div className="counter-tree-panel">
                          {visiblePostingTree.length > 0 ? (
                            renderPostingTreeNodes(visiblePostingTree)
                          ) : (
                            <div className="small-muted">Nenhuma conta de passivo encontrada para o filtro.</div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Data da postagem</label>
                  <input
                    type="date"
                    className="form-control"
                    value={postingDate}
                    disabled={isInvoicePosted}
                    onChange={(event) => setPostingDate(event.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label d-block">Ativo</label>
                  <input
                    type="checkbox"
                    className="form-check-input mt-2"
                    checked={Boolean(selectedInvoice.active)}
                    onChange={(event) =>
                      setInvoices((current) =>
                        current.map((invoice) =>
                          invoice.guid === selectedInvoice.guid
                            ? { ...invoice, active: event.target.checked }
                            : invoice
                        )
                      )
                    }
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Status</label>
                  <div className="invoice-status">{invoiceStatusLabel(selectedInvoice.status)}</div>
                </div>
                <div className="col-md-8 d-flex justify-content-end gap-2">
                  {isInvoicePosted ? (
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={unpostSelectedInvoice}>
                      Desfazer postagem
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={postSelectedInvoice}
                      disabled={!postingAccountGuid || selectedInvoice.entries.length === 0}
                    >
                      Postar compra
                    </button>
                  )}
                  <button type="submit" className="btn btn-accent btn-sm">
                    Salvar cabeçalho
                  </button>
                </div>
              </form>

              {isInvoicePosted ? (
                <div className="invoice-payment-panel mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h6 className="mb-0">Pagamentos</h6>
                    <div className="small-muted">
                      Em aberto:{" "}
                      {formatMoney(
                        selectedInvoice.open_amount_num,
                        selectedInvoice.open_amount_denom,
                        selectedInvoiceMnemonic
                      )}
                    </div>
                  </div>

                  <form onSubmit={submitPayment} className="row g-2 mb-3">
                    <div className="col-md-4">
                      <label className="form-label">Conta de pagamento</label>
                      <div className="tree-select">
                        <button
                          type="button"
                          className="form-select tree-select-toggle"
                          onClick={togglePaymentPicker}
                        >
                          <span className="tree-select-label">{paymentAccountLabel}</span>
                          <span className="tree-select-caret">{paymentPickerOpen ? "▲" : "▼"}</span>
                        </button>
                        {paymentPickerOpen ? (
                          <div className="tree-select-menu">
                            <input
                              className="form-control mb-2"
                              value={paymentSearch}
                              onChange={(event) => setPaymentSearch(event.target.value)}
                              placeholder="Filtrar conta de pagamento"
                            />
                            <div className="counter-tree-panel">
                              {visiblePaymentTree.length > 0 ? (
                                renderPaymentTreeNodes(visiblePaymentTree)
                              ) : (
                                <div className="small-muted">Nenhuma conta encontrada para o filtro.</div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Valor</label>
                      <input
                        className="form-control"
                        value={paymentForm.amount}
                        onChange={(event) =>
                          setPaymentForm((current) => ({ ...current, amount: event.target.value }))
                        }
                        onBlur={() =>
                          setPaymentForm((current) => ({
                            ...current,
                            amount: formatDecimalInput(current.amount, 2, true)
                          }))
                        }
                        placeholder="0,00"
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Data</label>
                      <input
                        type="date"
                        className="form-control"
                        value={paymentForm.payment_date}
                        onChange={(event) =>
                          setPaymentForm((current) => ({ ...current, payment_date: event.target.value }))
                        }
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Memória</label>
                      <input
                        className="form-control"
                        value={paymentForm.memo}
                        onChange={(event) =>
                          setPaymentForm((current) => ({ ...current, memo: event.target.value }))
                        }
                      />
                    </div>
                    <div className="col-md-1 d-flex align-items-end">
                      <button
                        type="submit"
                        className="btn btn-accent btn-sm w-100"
                        disabled={!paymentForm.transfer_account_guid || selectedInvoiceOpenAmount <= 0}
                      >
                        Pagar
                      </button>
                    </div>
                  </form>

                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Conta</th>
                          <th>Memória</th>
                          <th className="text-end">Valor</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedInvoice.payments || []).map((payment) => {
                          const account = accountsById.get(payment.transfer_account_guid);
                          return (
                            <tr key={payment.tx_guid}>
                              <td>{formatDateDisplay(payment.payment_date)}</td>
                              <td>
                                {account
                                  ? accountFullNameById.get(account.id) || account.name
                                  : payment.transfer_account_guid}
                              </td>
                              <td>{payment.memo || "-"}</td>
                              <td className="text-end">
                                {formatMoney(payment.amount_num, payment.amount_denom, selectedInvoiceMnemonic)}
                              </td>
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => undoPayment(payment.tx_guid)}
                                >
                                  Desfazer
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {(selectedInvoice.payments || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="small-muted">
                              Nenhum pagamento registrado para esta compra.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div className="table-responsive mb-3">
                <table className="table table-sm invoice-entry-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Ação</th>
                      <th>Conta de Despesa</th>
                      <th>Quantidade</th>
                      <th>Preço Unitário</th>
                      <th>Desconto</th>
                      <th>Tributável</th>
                      <th>Subtotal</th>
                      <th>Imposto</th>
                      <th>Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.entries.map((entry) => {
                      const account = accountsById.get(entry.income_account_guid);
                      const discountValue = entry.discount_type === "VALUE"
                        ? rationalToNumber(entry.discount_num, entry.discount_denom)
                        : rationalToNumber(entry.discount_num, entry.discount_denom) * 100;
                      const discountLabel = entry.discount_type === "VALUE"
                        ? formatMoney(entry.discount_num, entry.discount_denom, selectedInvoiceMnemonic)
                        : `${decimalString(discountValue, 2)}%`;

                      return (
                        <tr key={entry.guid}>
                          <td>{formatDateDisplay(entry.date)}</td>
                          <td>{entry.description || "-"}</td>
                          <td>{entry.action || "-"}</td>
                          <td>{account ? accountFullNameById.get(account.id) || account.name : entry.income_account_guid}</td>
                          <td>{decimalString(rationalToNumber(entry.quantity_num, entry.quantity_denom), 3)}</td>
                          <td>{formatMoney(entry.unit_price_num, entry.unit_price_denom, selectedInvoiceMnemonic)}</td>
                          <td>{discountLabel}</td>
                          <td>{entry.taxable ? "Sim" : "Não"}</td>
                          <td>{formatMoney(entry.subtotal_num, entry.subtotal_denom, selectedInvoiceMnemonic)}</td>
                          <td>{formatMoney(entry.tax_num, entry.tax_denom, selectedInvoiceMnemonic)}</td>
                          <td>{formatMoney(entry.total_num, entry.total_denom, selectedInvoiceMnemonic)}</td>
                          <td>
                            <div className="d-flex gap-1">
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => startEditEntry(entry)}
                                disabled={isInvoicePosted}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => removeEntry(entry.guid)}
                                disabled={isInvoicePosted}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {selectedInvoice.entries.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="small-muted">
                          Nenhuma entrada. Adicione a primeira linha de lançamento abaixo.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <form onSubmit={submitEntry} className="invoice-entry-form mb-3">
                {isInvoicePosted ? (
                  <div className="small-muted mb-2">Compra postada. Desfaça a postagem para editar linhas.</div>
                ) : null}
                <fieldset disabled={isInvoicePosted}>
                  <div className="row g-2">
                  <div className="col-md-2">
                    <label className="form-label">Data</label>
                    <input
                      type="date"
                      className="form-control"
                      value={entryForm.date}
                      onChange={(event) => setEntryForm((current) => ({ ...current, date: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-2 billing-entry-description-col">
                    <label className="form-label">Descrição</label>
                    <input
                      className="form-control"
                      value={entryForm.description}
                      onChange={(event) =>
                        setEntryForm((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </div>
                  <div className="col-md-1">
                    <label className="form-label">Ação</label>
                    <input
                      className="form-control"
                      value={entryForm.action}
                      onChange={(event) => setEntryForm((current) => ({ ...current, action: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-2 billing-entry-expense-col">
                    <label className="form-label">Conta de Despesa</label>
                    <div className="tree-select">
                      <button
                        type="button"
                        className="form-select tree-select-toggle"
                        onClick={toggleIncomePicker}
                      >
                        <span
                          className="tree-select-label"
                          title={
                            selectedIncomeAccount
                              ? `${selectedIncomeAccountPath} (${selectedIncomeAccount.type})`
                              : incomeAccountLabel
                          }
                        >
                          {incomeAccountLabel}
                        </span>
                        <span className="tree-select-caret">{incomePickerOpen ? "▲" : "▼"}</span>
                      </button>
                      {incomePickerOpen ? (
                        <div className="tree-select-menu">
                          <input
                            className="form-control mb-2"
                            value={incomeSearch}
                            onChange={(event) => setIncomeSearch(event.target.value)}
                            placeholder="Filtrar conta de despesa"
                          />
                          <div className="counter-tree-panel">
                            {visibleIncomeTree.length > 0 ? (
                              renderIncomeTreeNodes(visibleIncomeTree)
                            ) : (
                              <div className="small-muted">Nenhuma conta de despesa encontrada para o filtro.</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="col-md-1">
                    <label className="form-label">Quantidade</label>
                    <input
                      className="form-control"
                      value={entryForm.quantity}
                      onChange={(event) => setEntryForm((current) => ({ ...current, quantity: event.target.value }))}
                      onBlur={() =>
                        setEntryForm((current) => ({
                          ...current,
                          quantity: formatDecimalInput(current.quantity, 3)
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="col-md-1">
                    <label className="form-label">Preço Unitário</label>
                    <input
                      className="form-control"
                      value={entryForm.unit_price}
                      onChange={(event) =>
                        setEntryForm((current) => ({ ...current, unit_price: event.target.value }))
                      }
                      onBlur={() =>
                        setEntryForm((current) => ({
                          ...current,
                          unit_price: formatDecimalInput(current.unit_price, 2, true)
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="col-md-1">
                    <label className="form-label">Tipo Desc.</label>
                    <select
                      className="form-select"
                      value={entryForm.discount_type}
                      onChange={(event) =>
                        setEntryForm((current) => ({ ...current, discount_type: event.target.value }))
                      }
                    >
                      <option value="PERCENT">%</option>
                      <option value="VALUE">Valor</option>
                    </select>
                  </div>
                  <div className="col-md-1">
                    <label className="form-label">Desconto</label>
                    <input
                      className="form-control"
                      value={entryForm.discount}
                      onChange={(event) => setEntryForm((current) => ({ ...current, discount: event.target.value }))}
                      onBlur={() =>
                        setEntryForm((current) => ({
                          ...current,
                          discount: formatDecimalInput(
                            current.discount,
                            2,
                            current.discount_type === "VALUE"
                          )
                        }))
                      }
                    />
                  </div>
                  <div className="col-md-1 d-flex align-items-end">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={entryForm.taxable}
                        onChange={(event) =>
                          setEntryForm((current) => ({ ...current, taxable: event.target.checked }))
                        }
                      />
                      <label className="form-check-label">Trib.</label>
                    </div>
                  </div>
                  </div>

                  <div className="row g-2 mt-1">
                    <div className="col-md-4">
                      <label className="form-label">Notas da linha</label>
                      <input
                        className="form-control"
                        value={entryForm.notes}
                        onChange={(event) => setEntryForm((current) => ({ ...current, notes: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-8 d-flex justify-content-end align-items-end gap-2">
                      {editingEntryGuid ? (
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetEntryEditor}>
                          Cancelar edição
                        </button>
                      ) : null}
                      <button type="submit" className="btn btn-accent btn-sm">
                        {editingEntryGuid ? "Salvar linha" : "Adicionar linha"}
                      </button>
                    </div>
                  </div>
                </fieldset>
              </form>

              <div className="invoice-totals">
                <div>
                  <strong>Fornecedor:</strong> {selectedInvoiceVendor?.name || "fornecedor não encontrado"}
                </div>
                <div>
                  <strong>Subtotal:</strong>{" "}
                  {formatMoney(selectedInvoice.subtotal_num, selectedInvoice.subtotal_denom, selectedInvoiceMnemonic)}
                </div>
                <div>
                  <strong>Impostos:</strong>{" "}
                  {formatMoney(selectedInvoice.tax_num, selectedInvoice.tax_denom, selectedInvoiceMnemonic)}
                </div>
                <div>
                  <strong>Total:</strong>{" "}
                  {formatMoney(selectedInvoice.total_num, selectedInvoice.total_denom, selectedInvoiceMnemonic)}
                </div>
                <div>
                  <strong>Pago:</strong>{" "}
                  {formatMoney(
                    selectedInvoice.paid_amount_num,
                    selectedInvoice.paid_amount_denom,
                    selectedInvoiceMnemonic
                  )}
                </div>
                <div>
                  <strong>Em aberto:</strong>{" "}
                  {formatMoney(
                    selectedInvoice.open_amount_num,
                    selectedInvoice.open_amount_denom,
                    selectedInvoiceMnemonic
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="small-muted">Selecione uma compra para editar.</div>
          )}
        </div>
      </div>
    </div>
  );
}
