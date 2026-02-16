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
  const normalized = String(input ?? "").trim().replace(",", ".");
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function decimalToRational(input, scale = 100) {
  const value = parseDecimal(input);
  if (!Number.isFinite(value)) return null;
  return {
    num: Math.round(value * scale),
    denom: scale
  };
}

function decimalString(value, precision = 2) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(precision).replace(/\.?0+$/, "");
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

export default function InvoicingPage() {
  const [books, setBooks] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedBook, setSelectedBook] = useState("");
  const [selectedInvoiceGuid, setSelectedInvoiceGuid] = useState("");
  const [editingEntryGuid, setEditingEntryGuid] = useState("");
  const [entryForm, setEntryForm] = useState(defaultEntryForm());
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: "INVOICE",
    id: "000001",
    date_opened: todayIsoDate(),
    customer_guid: "",
    billing_id: "",
    terms: "",
    notes: ""
  });

  const commoditiesById = useMemo(
    () => new Map(commodities.map((commodity) => [commodity.id, commodity])),
    [commodities]
  );
  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.guid, customer])),
    [customers]
  );
  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );
  const incomeAccounts = useMemo(
    () => accounts.filter((account) => account.type === "INCOME"),
    [accounts]
  );
  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.guid === selectedInvoiceGuid) || null,
    [invoices, selectedInvoiceGuid]
  );
  const selectedInvoiceCustomer = selectedInvoice
    ? customersById.get(selectedInvoice.customer_guid) || null
    : null;
  const selectedInvoiceMnemonic = selectedInvoice
    ? commoditiesById.get(selectedInvoice.currency_guid)?.mnemonic || ""
    : "";

  const loadBooks = async () => {
    const response = await api.get("/books");
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setBooks(response.data);
    if (!selectedBook && response.data.length > 0) {
      setSelectedBook(response.data[0].id);
    }
  };

  const loadCommodities = async () => {
    const response = await api.get("/commodities?namespace=CURRENCY");
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setCommodities(response.data);
  };

  const loadCustomers = async (bookId) => {
    const response = await api.get(`/customers?book_id=${bookId}`);
    if (!response.ok) {
      setError(response.error);
      return [];
    }
    setCustomers(response.data);
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

  const loadInvoices = async (bookId, preferredGuid = "") => {
    const response = await api.get(`/invoices?book_id=${bookId}`);
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
      if (current && response.data.some((item) => item.guid === current)) return current;
      return response.data.length > 0 ? response.data[0].guid : "";
    });
    return response.data;
  };

  const loadBookData = async (bookId, preferredGuid = "") => {
    if (!bookId) return;
    const [loadedCustomers, loadedAccounts, loadedInvoices] = await Promise.all([
      loadCustomers(bookId),
      loadAccounts(bookId),
      loadInvoices(bookId, preferredGuid)
    ]);
    const defaultCustomer = loadedCustomers[0]?.guid || "";
    const defaultIncome = loadedAccounts.find((account) => account.type === "INCOME")?.id || "";
    setCreateForm((current) => ({
      ...current,
      customer_guid: current.customer_guid && loadedCustomers.some((customer) => customer.guid === current.customer_guid)
        ? current.customer_guid
        : defaultCustomer,
      id: loadedInvoices.length > 0 ? nextInvoiceId(loadedInvoices) : "000001"
    }));
    setEntryForm((current) => ({
      ...current,
      income_account_guid:
        current.income_account_guid &&
        loadedAccounts.some((account) => account.id === current.income_account_guid)
          ? current.income_account_guid
          : defaultIncome
    }));
  };

  useEffect(() => {
    loadBooks();
    loadCommodities();
  }, []);

  useEffect(() => {
    if (!selectedBook) return;
    loadBookData(selectedBook);
    setEditingEntryGuid("");
  }, [selectedBook]);

  useEffect(() => {
    if (!selectedInvoiceGuid) {
      setEditingEntryGuid("");
      const defaultIncome = incomeAccounts[0]?.id || "";
      setEntryForm(defaultEntryForm(defaultIncome));
    }
  }, [selectedInvoiceGuid, incomeAccounts]);

  const openCreateDialog = () => {
    setCreateOpen(true);
    setCreateForm((current) => ({
      ...current,
      type: "INVOICE",
      id: nextInvoiceId(invoices),
      date_opened: todayIsoDate(),
      customer_guid: current.customer_guid || customers[0]?.guid || "",
      billing_id: "",
      terms: "",
      notes: ""
    }));
  };

  const closeCreateDialog = () => {
    setCreateOpen(false);
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    if (!selectedBook) return;
    if (!createForm.customer_guid) {
      setError({ code: "VALIDATION_ERROR", message: "Selecione um cliente", details: {} });
      return;
    }

    const customer = customersById.get(createForm.customer_guid);
    const payload = {
      book_id: selectedBook,
      type: createForm.type,
      id: createForm.id.trim() || nextInvoiceId(invoices),
      date_opened: createForm.date_opened ? `${createForm.date_opened}T00:00:00Z` : null,
      notes: createForm.notes || "",
      currency_guid: customer?.currency_guid || commodities[0]?.id || "",
      customer_guid: createForm.customer_guid,
      billing_id: createForm.billing_id.trim() || null,
      terms: createForm.terms.trim() || null
    };

    const response = await api.post("/invoices", payload);
    if (!response.ok) {
      setError(response.error);
      return;
    }

    setCreateOpen(false);
    await loadBookData(selectedBook, response.data.guid);
  };

  const submitInvoicePatch = async (event) => {
    event.preventDefault();
    if (!selectedInvoice) return;

    const payload = {
      type: selectedInvoice.type,
      id: selectedInvoice.id,
      date_opened: selectedInvoice.date_opened || null,
      notes: selectedInvoice.notes || "",
      active: Boolean(selectedInvoice.active),
      currency_guid: selectedInvoice.currency_guid,
      customer_guid: selectedInvoice.customer_guid,
      billing_id: selectedInvoice.billing_id || null,
      terms: selectedInvoice.terms || null
    };

    const response = await api.patch(`/invoices/${selectedInvoice.guid}`, payload);
    if (!response.ok) {
      setError(response.error);
      return;
    }

    await loadBookData(selectedBook, selectedInvoice.guid);
  };

  const removeInvoice = async (invoiceGuid) => {
    const response = await api.del(`/invoices/${invoiceGuid}`);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setEditingEntryGuid("");
    setEntryForm(defaultEntryForm(incomeAccounts[0]?.id || ""));
    await loadBookData(selectedBook);
  };

  const resetEntryEditor = () => {
    setEditingEntryGuid("");
    setEntryForm(defaultEntryForm(incomeAccounts[0]?.id || ""));
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
      unit_price: decimalString(rationalToNumber(entry.unit_price_num, entry.unit_price_denom), 2),
      discount: decimalString(discountValue, 2),
      discount_type: discountType,
      discount_how: entry.discount_how || "PRETAX",
      taxable: Boolean(entry.taxable),
      tax_included: Boolean(entry.tax_included)
    });
  };

  const removeEntry = async (entryGuid) => {
    if (!selectedInvoice) return;
    const response = await api.del(`/invoices/${selectedInvoice.guid}/entries/${entryGuid}`);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    if (editingEntryGuid === entryGuid) {
      resetEntryEditor();
    }
    await loadBookData(selectedBook, selectedInvoice.guid);
  };

  const submitEntry = async (event) => {
    event.preventDefault();
    if (!selectedInvoice) return;
    if (!entryForm.income_account_guid) {
      setError({ code: "VALIDATION_ERROR", message: "Selecione a conta de receita", details: {} });
      return;
    }

    const quantity = decimalToRational(entryForm.quantity, 1000);
    const unitPrice = decimalToRational(entryForm.unit_price, 100);
    if (!quantity || !unitPrice || quantity.denom <= 0 || unitPrice.denom <= 0) {
      setError({ code: "VALIDATION_ERROR", message: "Quantidade e preco devem ser numericos", details: {} });
      return;
    }

    const discountValue = parseDecimal(entryForm.discount);
    if (!Number.isFinite(discountValue)) {
      setError({ code: "VALIDATION_ERROR", message: "Desconto invalido", details: {} });
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
      setError({ code: "VALIDATION_ERROR", message: "Desconto invalido", details: {} });
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
      ? await api.patch(`/invoices/${selectedInvoice.guid}/entries/${editingEntryGuid}`, payload)
      : await api.post(`/invoices/${selectedInvoice.guid}/entries`, payload);
    if (!response.ok) {
      setError(response.error);
      return;
    }

    resetEntryEditor();
    await loadBookData(selectedBook, selectedInvoice.guid);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Faturamento</h2>
          <div className="small-muted">Fluxo de faturas de cliente em duas etapas (nova fatura e edicao).</div>
        </div>
        <button type="button" className="btn btn-accent" onClick={openCreateDialog} disabled={!selectedBook}>
          Nova Fatura
        </button>
      </div>

      <div className="row g-3 mb-3">
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
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error.code}: {error.message}
        </div>
      ) : null}

      {createOpen ? (
        <div className="invoice-dialog mb-4">
          <h5 className="mb-3">Nova Fatura</h5>
          <form onSubmit={submitCreate} className="row g-3">
            <div className="col-md-12">
              <div className="invoice-fieldset">
                <div className="invoice-fieldset-title">Informacao da fatura</div>
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
                      Fatura
                    </label>
                    <label className="d-flex align-items-center gap-1">
                      <input
                        type="radio"
                        name="invoice_type"
                        checked={createForm.type === "CREDIT_NOTE"}
                        onChange={() => setCreateForm((current) => ({ ...current, type: "CREDIT_NOTE" }))}
                      />
                      Nota de credito
                    </label>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Numero da fatura</label>
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
                <div className="invoice-fieldset-title">Informacoes da cobranca</div>
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label">Cliente</label>
                    <select
                      className="form-select"
                      value={createForm.customer_guid}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, customer_guid: event.target.value }))
                      }
                      required
                    >
                      <option value="">Selecione...</option>
                      {customers.map((customer) => (
                        <option key={customer.guid} value={customer.guid}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Trabalho</label>
                    <input className="form-control" disabled value="" placeholder="" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">ID da cobranca</label>
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
        <div className="invoice-list-panel">
          <h6 className="mb-2">Faturas</h6>
          <div className="table-responsive">
            <table className="table table-sm invoice-list-table">
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const customer = customersById.get(invoice.customer_guid);
                  const mnemonic = commoditiesById.get(invoice.currency_guid)?.mnemonic || "";
                  return (
                    <tr
                      key={invoice.guid}
                      className={invoice.guid === selectedInvoiceGuid ? "is-selected" : ""}
                      onClick={() => setSelectedInvoiceGuid(invoice.guid)}
                    >
                      <td>{invoice.id}</td>
                      <td>{customer?.name || "-"}</td>
                      <td>{formatDateDisplay(invoice.date_opened)}</td>
                      <td>{formatMoney(invoice.total_num, invoice.total_denom, mnemonic)}</td>
                    </tr>
                  );
                })}
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="small-muted">
                      Nenhuma fatura neste book.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="invoice-editor-panel">
          {selectedInvoice ? (
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h5 className="mb-0">Edite a fatura - {selectedInvoice.id}</h5>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => removeInvoice(selectedInvoice.guid)}
                >
                  Excluir fatura
                </button>
              </div>

              <form onSubmit={submitInvoicePatch} className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label">Tipo</label>
                  <select
                    className="form-select"
                    value={selectedInvoice.type}
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
                    <option value="INVOICE">Fatura</option>
                    <option value="CREDIT_NOTE">Nota de credito</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Numero da fatura</label>
                  <input
                    className="form-control"
                    value={selectedInvoice.id}
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
                  <label className="form-label">Cliente</label>
                  <select
                    className="form-select"
                    value={selectedInvoice.customer_guid}
                    onChange={(event) =>
                      setInvoices((current) =>
                        current.map((invoice) => {
                          if (invoice.guid !== selectedInvoice.guid) return invoice;
                          const customer = customersById.get(event.target.value);
                          return {
                            ...invoice,
                            customer_guid: event.target.value,
                            currency_guid: customer?.currency_guid || invoice.currency_guid
                          };
                        })
                      )
                    }
                  >
                    {customers.map((customer) => (
                      <option key={customer.guid} value={customer.guid}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">ID da cobranca</label>
                  <input
                    className="form-control"
                    value={selectedInvoice.billing_id || ""}
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
                    <option value="None">None</option>
                  </select>
                </div>
                <div className="col-md-8">
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
                  <div className="invoice-status">{selectedInvoice.status}</div>
                </div>
                <div className="col-md-12 d-flex justify-content-end">
                  <button type="submit" className="btn btn-accent btn-sm">
                    Salvar cabecalho
                  </button>
                </div>
              </form>

              <div className="table-responsive mb-3">
                <table className="table table-sm invoice-entry-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descricao</th>
                      <th>Acao</th>
                      <th>Conta de Receita</th>
                      <th>Quantidade</th>
                      <th>Preco Unitario</th>
                      <th>Desconto</th>
                      <th>Tributavel</th>
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
                          <td>{account?.name || entry.income_account_guid}</td>
                          <td>{decimalString(rationalToNumber(entry.quantity_num, entry.quantity_denom), 3)}</td>
                          <td>{formatMoney(entry.unit_price_num, entry.unit_price_denom, selectedInvoiceMnemonic)}</td>
                          <td>{discountLabel}</td>
                          <td>{entry.taxable ? "Sim" : "Nao"}</td>
                          <td>{formatMoney(entry.subtotal_num, entry.subtotal_denom, selectedInvoiceMnemonic)}</td>
                          <td>{formatMoney(entry.tax_num, entry.tax_denom, selectedInvoiceMnemonic)}</td>
                          <td>{formatMoney(entry.total_num, entry.total_denom, selectedInvoiceMnemonic)}</td>
                          <td>
                            <div className="d-flex gap-1">
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => startEditEntry(entry)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => removeEntry(entry.guid)}
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
                          Nenhuma entrada. Adicione a primeira linha de faturamento abaixo.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <form onSubmit={submitEntry} className="invoice-entry-form mb-3">
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
                  <div className="col-md-2">
                    <label className="form-label">Descricao</label>
                    <input
                      className="form-control"
                      value={entryForm.description}
                      onChange={(event) =>
                        setEntryForm((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </div>
                  <div className="col-md-1">
                    <label className="form-label">Acao</label>
                    <input
                      className="form-control"
                      value={entryForm.action}
                      onChange={(event) => setEntryForm((current) => ({ ...current, action: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Conta de Receita</label>
                    <select
                      className="form-select"
                      value={entryForm.income_account_guid}
                      onChange={(event) =>
                        setEntryForm((current) => ({ ...current, income_account_guid: event.target.value }))
                      }
                      required
                    >
                      <option value="">Selecione...</option>
                      {incomeAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-1">
                    <label className="form-label">Quantidade</label>
                    <input
                      className="form-control"
                      value={entryForm.quantity}
                      onChange={(event) => setEntryForm((current) => ({ ...current, quantity: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-1">
                    <label className="form-label">Preco Unitario</label>
                    <input
                      className="form-control"
                      value={entryForm.unit_price}
                      onChange={(event) =>
                        setEntryForm((current) => ({ ...current, unit_price: event.target.value }))
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
                        Cancelar edicao
                      </button>
                    ) : null}
                    <button type="submit" className="btn btn-accent btn-sm">
                      {editingEntryGuid ? "Salvar linha" : "Adicionar linha"}
                    </button>
                  </div>
                </div>
              </form>

              <div className="invoice-totals">
                <div>
                  <strong>Cliente:</strong> {selectedInvoiceCustomer?.name || "-"}
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
              </div>
            </div>
          ) : (
            <div className="small-muted">Selecione uma fatura para editar.</div>
          )}
        </div>
      </div>
    </div>
  );
}
