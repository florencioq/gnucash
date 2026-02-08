import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import AccountTree from "../components/AccountTree.jsx";

export default function AccountsPage() {
  const [books, setBooks] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [selectedBook, setSelectedBook] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [tree, setTree] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: "",
    type: "ASSET",
    commodity_id: "",
    parent_id: "",
    is_placeholder: false
  });

  const isRootType = form.type === "ROOT";

  const bookOptions = useMemo(() => books, [books]);

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
    if (!form.commodity_id && res.data.length > 0) {
      setForm((prev) => ({ ...prev, commodity_id: res.data[0].id }));
    }
  };

  const loadAccounts = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/accounts?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAccounts(res.data);
  };

  const loadTree = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/accounts/tree?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTree(res.data);
  };

  const loadAll = async (bookId) => {
    await loadAccounts(bookId);
    await loadTree(bookId);
  };

  useEffect(() => {
    loadBooks();
    loadCommodities();
  }, []);

  useEffect(() => {
    if (selectedBook) {
      loadAll(selectedBook);
    }
  }, [selectedBook]);

  const create = async (event) => {
    event.preventDefault();
    if (!selectedBook) return;
    const payload = {
      book_id: selectedBook,
      name: form.name,
      type: form.type,
      commodity_id: form.commodity_id,
      is_placeholder: form.is_placeholder
    };
    if (!isRootType && form.parent_id) {
      payload.parent_id = form.parent_id;
    }
    const res = await api.post("/accounts", payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setForm({
      name: "",
      type: "ASSET",
      commodity_id: form.commodity_id,
      parent_id: "",
      is_placeholder: false
    });
    await loadAll(selectedBook);
  };

  const remove = async (accountId) => {
    const res = await api.del(`/accounts/${accountId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await loadAll(selectedBook);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Accounts</h2>
          <div className="small-muted">Manage the account hierarchy per book.</div>
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
            {bookOptions.map((book) => (
              <option key={book.id} value={book.id}>
                {book.name || book.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <form className="row g-2 align-items-end mb-4" onSubmit={create}>
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
          <label className="form-label">Type</label>
          <select
            className="form-select"
            value={form.type}
            onChange={(event) => {
              const nextType = event.target.value;
              setForm({
                ...form,
                type: nextType,
                parent_id: nextType === "ROOT" ? "" : form.parent_id,
                is_placeholder: nextType === "ROOT" ? true : form.is_placeholder
              });
            }}
          >
            {[
              "ROOT",
              "ASSET",
              "LIABILITY",
              "INCOME",
              "EXPENSE",
              "EQUITY"
            ].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Commodity</label>
          <select
            className="form-select"
            value={form.commodity_id}
            onChange={(event) => setForm({ ...form, commodity_id: event.target.value })}
          >
            {commodities.map((commodity) => (
              <option key={commodity.id} value={commodity.id}>
                {commodity.mnemonic}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label">Parent</label>
          <select
            className="form-select"
            value={form.parent_id}
            onChange={(event) => setForm({ ...form, parent_id: event.target.value })}
            disabled={isRootType}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          {isRootType ? (
            <div className="small-muted mt-1">ROOT must not have a parent.</div>
          ) : null}
        </div>
        <div className="col-md-2">
          <label className="form-label">Placeholder</label>
          <select
            className="form-select"
            value={form.is_placeholder ? "true" : "false"}
            onChange={(event) =>
              setForm({ ...form, is_placeholder: event.target.value === "true" })
            }
          >
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        </div>
        <div className="col-md-3">
          <button className="btn btn-accent w-100" type="submit">
            Create Account
          </button>
        </div>
      </form>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error.code}: {error.message}
        </div>
      ) : null}

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="section-card">
            <h5 className="mb-3">Account List</h5>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Commodity</th>
                    <th>Parent</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td className="fw-semibold">{account.name}</td>
                      <td>{account.type}</td>
                      <td className="small-muted">{account.commodity_id}</td>
                      <td className="small-muted">{account.parent_id || "root"}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-danger"
                          type="button"
                          onClick={() => remove(account.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="section-card">
            <h5 className="mb-3">Account Tree</h5>
            <AccountTree nodes={tree} />
          </div>
        </div>
      </div>
    </div>
  );
}
