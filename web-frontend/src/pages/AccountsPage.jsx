import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import AccountTree from "../components/AccountTree.jsx";

export default function AccountsPage({ onOpenLedger = () => {} }) {
  const [books, setBooks] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [selectedBook, setSelectedBook] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [tree, setTree] = useState([]);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    type: "ASSET",
    commodity_id: "",
    parent_id: "",
    is_placeholder: false
  });

  const isRootType = form.type === "ROOT";

  const bookOptions = useMemo(() => books, [books]);
  const commodityMnemonicById = useMemo(
    () => new Map(commodities.map((commodity) => [commodity.id, commodity.mnemonic])),
    [commodities]
  );

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
    await Promise.all([loadAccounts(bookId), loadTree(bookId)]);
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

  const editAccount = async (account) => {
    setEditing({
      id: account.id,
      name: account.name,
      type: account.type,
      is_placeholder: account.is_placeholder
    });
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!editing) return;
    const trimmed = editing.name.trim();
    if (!trimmed) {
      setError({ code: "VALIDATION_ERROR", message: "name cannot be empty", details: {} });
      return;
    }
    const isPlaceholder = editing.type === "ROOT" ? true : editing.is_placeholder;
    const res = await api.patch(`/accounts/${editing.id}`, {
      name: trimmed,
      is_placeholder: isPlaceholder
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(null);
    await loadAll(selectedBook);
  };

  const openLedgerFromTree = (node) => {
    if (!selectedBook || !node?.id || node.type === "ROOT") return;
    onOpenLedger({ bookId: selectedBook, accountId: node.id });
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

      <div className="section-card">
        <h5 className="mb-3">Account Tree</h5>
        {editing ? (
          <form className="row g-2 align-items-end mb-3" onSubmit={submitEdit}>
            <div className="col-md-4">
              <label className="form-label">Edit Name</label>
              <input
                className="form-control"
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                required
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Placeholder</label>
              <select
                className="form-select"
                value={editing.type === "ROOT" ? "true" : editing.is_placeholder ? "true" : "false"}
                onChange={(event) =>
                  setEditing({ ...editing, is_placeholder: event.target.value === "true" })
                }
                disabled={editing.type === "ROOT"}
              >
                <option value="false">False</option>
                <option value="true">True</option>
              </select>
              {editing.type === "ROOT" ? (
                <div className="small-muted mt-1">ROOT must be placeholder.</div>
              ) : null}
            </div>
            <div className="col-md-4 d-flex gap-2">
              <button className="btn btn-accent" type="submit">
                Save Changes
              </button>
              <button className="btn btn-outline-secondary" type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
        <AccountTree
          nodes={tree}
          commodityMnemonicById={commodityMnemonicById}
          onLedger={openLedgerFromTree}
          onEdit={(node) => editAccount(node)}
          onDelete={(node) => remove(node.id)}
        />
      </div>
    </div>
  );
}
