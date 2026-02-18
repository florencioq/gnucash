import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function BooksPage() {
  const [books, setBooks] = useState([]);
  const [name, setName] = useState("");
  const [createIsActive, setCreateIsActive] = useState(false);
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
    const res = await api.post("/books", { name: name || null, is_active: createIsActive });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setName("");
    setCreateIsActive(false);
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

  const activateBook = async (bookId) => {
    const res = await api.patch(`/books/${bookId}`, { is_active: true });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await load();
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Livros</h2>
          <div className="small-muted">Crie e gerencie seus livros.</div>
        </div>
      </div>

      <form className="row g-2 align-items-end mb-4" onSubmit={create}>
        <div className="col-md-6">
          <label className="form-label">Nome</label>
          <input
            className="form-control"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Exemplo"
          />
        </div>
        <div className="col-md-3">
          <label className="form-label d-block">Ativo</label>
          <div className="form-check mt-2">
            <input
              className="form-check-input"
              type="checkbox"
              checked={createIsActive}
              onChange={(event) => setCreateIsActive(event.target.checked)}
              id="create-active-book"
            />
            <label className="form-check-label" htmlFor="create-active-book">
              Marcar como ativo
            </label>
          </div>
        </div>
        <div className="col-md-3">
          <button className="btn btn-accent w-100" type="submit">
            Criar livro
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
              <th>Nome</th>
              <th>Ativo</th>
              <th>Criado em</th>
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
                    <span className="fw-semibold">{book.name || "(sem nome)"}</span>
                  )}
                </td>
                <td>
                  {book.is_active ? (
                    <span className="badge text-bg-success">Ativo</span>
                  ) : (
                    <span className="small-muted">-</span>
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
                      Salvar
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-outline-secondary me-2"
                      onClick={() => startEdit(book)}
                      type="button"
                    >
                      Editar
                    </button>
                  )}
                  {!book.is_active ? (
                    <button
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => activateBook(book.id)}
                      type="button"
                    >
                      Ativar
                    </button>
                  ) : null}
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => remove(book.id)}
                    type="button"
                  >
                    Excluir
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
