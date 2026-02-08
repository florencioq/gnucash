import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function BooksPage() {
  const [books, setBooks] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState({});

  const load = async () => {
    const res = await api.get("/books");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setBooks(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (event) => {
    event.preventDefault();
    const res = await api.post("/books", { name: name || null });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setName("");
    await load();
  };

  const remove = async (bookId) => {
    const res = await api.del(`/books/${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await load();
  };

  const startEdit = (book) => {
    setEditing({ ...editing, [book.id]: book.name || "" });
  };

  const saveEdit = async (book) => {
    const payload = { name: editing[book.id] || null };
    const res = await api.patch(`/books/${book.id}`, payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing((prev) => {
      const next = { ...prev };
      delete next[book.id];
      return next;
    });
    await load();
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Books</h2>
          <div className="small-muted">Create and manage your books.</div>
        </div>
      </div>

      <form className="row g-2 align-items-end mb-4" onSubmit={create}>
        <div className="col-md-6">
          <label className="form-label">Name</label>
          <input
            className="form-control"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Demo"
          />
        </div>
        <div className="col-md-3">
          <button className="btn btn-accent w-100" type="submit">
            Create Book
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
              <th>Created</th>
              <th>ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book.id}>
                <td>
                  {editing[book.id] !== undefined ? (
                    <input
                      className="form-control"
                      value={editing[book.id]}
                      onChange={(event) =>
                        setEditing({ ...editing, [book.id]: event.target.value })
                      }
                    />
                  ) : (
                    <span className="fw-semibold">{book.name || "(unnamed)"}</span>
                  )}
                </td>
                <td>{new Date(book.created_at).toLocaleString()}</td>
                <td className="small-muted">{book.id}</td>
                <td className="text-end">
                  {editing[book.id] !== undefined ? (
                    <button
                      className="btn btn-sm btn-outline-success me-2"
                      onClick={() => saveEdit(book)}
                      type="button"
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-outline-secondary me-2"
                      onClick={() => startEdit(book)}
                      type="button"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => remove(book.id)}
                    type="button"
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
  );
}
