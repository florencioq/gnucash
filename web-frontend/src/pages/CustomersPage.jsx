import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";

function emptyToNull(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

export default function CustomersPage() {
  const [books, setBooks] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [selectedBook, setSelectedBook] = useState("");
  const [customers, setCustomers] = useState([]);
  const [editingGuid, setEditingGuid] = useState("");
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: "",
    id: "",
    currency_guid: "",
    notes: "",
    active: true,
    discount_num: "0",
    discount_denom: "1",
    credit_num: "0",
    credit_denom: "1",
    addr_name: "",
    addr_phone: "",
    addr_email: "",
    shipaddr_name: "",
    shipaddr_phone: "",
    shipaddr_email: ""
  });

  const commoditiesById = useMemo(
    () => new Map(commodities.map((commodity) => [commodity.id, commodity])),
    [commodities]
  );

  const resetForm = (currencyGuid = "") => {
    setForm({
      name: "",
      id: "",
      currency_guid: currencyGuid,
      notes: "",
      active: true,
      discount_num: "0",
      discount_denom: "1",
      credit_num: "0",
      credit_denom: "1",
      addr_name: "",
      addr_phone: "",
      addr_email: "",
      shipaddr_name: "",
      shipaddr_phone: "",
      shipaddr_email: ""
    });
  };

  const loadBooks = async () => {
    const res = await api.get("/books");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBooks(res.data);
    if (!selectedBook && res.data.length > 0) {
      setSelectedBook(res.data[0].id);
    }
  };

  const loadCommodities = async () => {
    const res = await api.get("/commodities?namespace=CURRENCY");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCommodities(res.data);
    if (!form.currency_guid && res.data.length > 0) {
      setForm((current) => ({ ...current, currency_guid: res.data[0].id }));
    }
  };

  const loadCustomers = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/customers?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setCustomers(res.data);
  };

  useEffect(() => {
    loadBooks();
    loadCommodities();
  }, []);

  useEffect(() => {
    if (selectedBook) {
      loadCustomers(selectedBook);
      setEditingGuid("");
    }
  }, [selectedBook]);

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedBook) return;

    const payload = {
      name: form.name.trim(),
      id: form.id.trim(),
      currency_guid: form.currency_guid,
      notes: form.notes,
      active: Boolean(form.active),
      discount_num: Number(form.discount_num),
      discount_denom: Number(form.discount_denom),
      credit_num: Number(form.credit_num),
      credit_denom: Number(form.credit_denom),
      addr_name: emptyToNull(form.addr_name),
      addr_phone: emptyToNull(form.addr_phone),
      addr_email: emptyToNull(form.addr_email),
      shipaddr_name: emptyToNull(form.shipaddr_name),
      shipaddr_phone: emptyToNull(form.shipaddr_phone),
      shipaddr_email: emptyToNull(form.shipaddr_email)
    };

    if (!editingGuid) {
      payload.book_id = selectedBook;
    }

    const res = editingGuid
      ? await api.patch(`/customers/${editingGuid}`, payload)
      : await api.post("/customers", payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setEditingGuid("");
    resetForm(form.currency_guid);
    await loadCustomers(selectedBook);
  };

  const startEdit = (customer) => {
    setError(null);
    setEditingGuid(customer.guid);
    setForm({
      name: customer.name || "",
      id: customer.id || "",
      currency_guid: customer.currency_guid || "",
      notes: customer.notes || "",
      active: Boolean(customer.active),
      discount_num: String(customer.discount_num ?? 0),
      discount_denom: String(customer.discount_denom ?? 1),
      credit_num: String(customer.credit_num ?? 0),
      credit_denom: String(customer.credit_denom ?? 1),
      addr_name: customer.addr_name || "",
      addr_phone: customer.addr_phone || "",
      addr_email: customer.addr_email || "",
      shipaddr_name: customer.shipaddr_name || "",
      shipaddr_phone: customer.shipaddr_phone || "",
      shipaddr_email: customer.shipaddr_email || ""
    });
  };

  const cancelEdit = () => {
    setEditingGuid("");
    resetForm(form.currency_guid || (commodities[0] || {}).id || "");
  };

  const remove = async (customerGuid) => {
    const res = await api.del(`/customers/${customerGuid}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (editingGuid === customerGuid) {
      cancelEdit();
    }
    await loadCustomers(selectedBook);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Customers</h2>
          <div className="small-muted">Cadastro de clientes no estilo GnuCash.</div>
        </div>
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

      <form className="row g-2 align-items-end mb-4" onSubmit={submit}>
        <div className="col-md-3">
          <label className="form-label">Name</label>
          <input
            className="form-control"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">ID</label>
          <input
            className="form-control"
            value={form.id}
            onChange={(event) => setForm({ ...form, id: event.target.value })}
            required
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Currency</label>
          <select
            className="form-select"
            value={form.currency_guid}
            onChange={(event) => setForm({ ...form, currency_guid: event.target.value })}
            required
          >
            {commodities.map((commodity) => (
              <option key={commodity.id} value={commodity.id}>
                {commodity.mnemonic}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label">Active</label>
          <select
            className="form-select"
            value={form.active ? "true" : "false"}
            onChange={(event) => setForm({ ...form, active: event.target.value === "true" })}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Notes</label>
          <input
            className="form-control"
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </div>

        <div className="col-md-2">
          <label className="form-label">Discount Num</label>
          <input
            className="form-control"
            type="number"
            value={form.discount_num}
            onChange={(event) => setForm({ ...form, discount_num: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Discount Denom</label>
          <input
            className="form-control"
            type="number"
            min="1"
            value={form.discount_denom}
            onChange={(event) => setForm({ ...form, discount_denom: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Credit Num</label>
          <input
            className="form-control"
            type="number"
            value={form.credit_num}
            onChange={(event) => setForm({ ...form, credit_num: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Credit Denom</label>
          <input
            className="form-control"
            type="number"
            min="1"
            value={form.credit_denom}
            onChange={(event) => setForm({ ...form, credit_denom: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Billing Name</label>
          <input
            className="form-control"
            value={form.addr_name}
            onChange={(event) => setForm({ ...form, addr_name: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Billing Phone</label>
          <input
            className="form-control"
            value={form.addr_phone}
            onChange={(event) => setForm({ ...form, addr_phone: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Billing Email</label>
          <input
            className="form-control"
            value={form.addr_email}
            onChange={(event) => setForm({ ...form, addr_email: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Shipping Name</label>
          <input
            className="form-control"
            value={form.shipaddr_name}
            onChange={(event) => setForm({ ...form, shipaddr_name: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Shipping Phone</label>
          <input
            className="form-control"
            value={form.shipaddr_phone}
            onChange={(event) => setForm({ ...form, shipaddr_phone: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Shipping Email</label>
          <input
            className="form-control"
            value={form.shipaddr_email}
            onChange={(event) => setForm({ ...form, shipaddr_email: event.target.value })}
          />
        </div>

        <div className="col-md-12 d-flex justify-content-end gap-2 mt-2">
          {editingGuid ? (
            <button className="btn btn-outline-secondary" type="button" onClick={cancelEdit}>
              Cancel
            </button>
          ) : null}
          <button className="btn btn-accent" type="submit">
            {editingGuid ? "Save Customer" : "Create Customer"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error.code}: {error.message}
        </div>
      ) : null}

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
              <th>Currency</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Active</th>
              <th>GUID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={8} className="small-muted">
                  No customers yet.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.guid}>
                  <td className="fw-semibold">{customer.name}</td>
                  <td>{customer.id}</td>
                  <td>{commoditiesById.get(customer.currency_guid)?.mnemonic || customer.currency_guid}</td>
                  <td>{customer.addr_email || "-"}</td>
                  <td>{customer.addr_phone || "-"}</td>
                  <td>{customer.active ? "True" : "False"}</td>
                  <td className="small-muted">{customer.guid}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-secondary me-2"
                      type="button"
                      onClick={() => startEdit(customer)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      type="button"
                      onClick={() => remove(customer.guid)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
