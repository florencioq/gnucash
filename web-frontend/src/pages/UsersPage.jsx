import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";

const INITIAL_FORM = {
  full_name: "",
  email: "",
  password: "",
  confirmPassword: ""
};

const DEFAULT_ACCESS_ROLE = "EDITOR";
const INITIAL_RESET_PASSWORD_FORM = {
  newPassword: "",
  confirmPassword: ""
};

function normalizeRole(value) {
  return value === "VIEWER" ? "VIEWER" : "EDITOR";
}

function formatCreatedAt(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [accessByUser, setAccessByUser] = useState({});
  const [accessFormByUser, setAccessFormByUser] = useState({});
  const [accessBusyByUser, setAccessBusyByUser] = useState({});
  const [resetPasswordFormByUser, setResetPasswordFormByUser] = useState({});
  const [resetPasswordBusyByUser, setResetPasswordBusyByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const [accessSuccess, setAccessSuccess] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    const res = await api.get("/auth/users");
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setUsers([]);
      return null;
    }
    const data = Array.isArray(res.data) ? res.data : [];
    setUsers(data);
    return data;
  };

  const loadBooks = async () => {
    const res = await api.get("/books");
    if (!res.ok) {
      setAccessError(res.error);
      setBooks([]);
      return [];
    }
    const data = Array.isArray(res.data) ? res.data : [];
    setBooks(data);
    return data;
  };

  const loadUserAccess = async (userId) => {
    const res = await api.get(`/auth/users/${userId}/books`);
    if (!res.ok) {
      setAccessError(res.error);
      return false;
    }
    const rows = Array.isArray(res.data) ? res.data : [];
    setAccessByUser((current) => ({ ...current, [userId]: rows }));
    return true;
  };

  const refreshUsersAndAccess = async () => {
    setAccessError(null);
    setAccessSuccess(null);

    const usersData = await loadUsers();
    if (!usersData) {
      setAccessByUser({});
      return;
    }

    const booksData = await loadBooks();
    const defaultBookId = booksData[0]?.id || "";
    setAccessFormByUser((current) => {
      const next = {};
      usersData.forEach((user) => {
        if (user.is_superuser) return;
        const existing = current[user.id] || {};
        next[user.id] = {
          book_id: existing.book_id || defaultBookId,
          role: normalizeRole(existing.role || DEFAULT_ACCESS_ROLE)
        };
      });
      return next;
    });
    setResetPasswordFormByUser((current) => {
      const next = {};
      usersData.forEach((user) => {
        next[user.id] = current[user.id] || INITIAL_RESET_PASSWORD_FORM;
      });
      return next;
    });

    const nonSuperusers = usersData.filter((user) => !user.is_superuser);
    if (nonSuperusers.length === 0) {
      setAccessByUser({});
      return;
    }

    const responses = await Promise.all(
      nonSuperusers.map(async (user) => ({
        userId: user.id,
        res: await api.get(`/auth/users/${user.id}/books`)
      }))
    );

    const nextAccess = {};
    let firstError = null;
    responses.forEach(({ userId, res }) => {
      if (!res.ok) {
        nextAccess[userId] = [];
        if (!firstError) firstError = res.error;
        return;
      }
      nextAccess[userId] = Array.isArray(res.data) ? res.data : [];
    });

    setAccessByUser(nextAccess);
    if (firstError) setAccessError(firstError);
  };

  useEffect(() => {
    refreshUsersAndAccess();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setAccessError(null);
    setAccessSuccess(null);
    setPasswordError(null);
    setPasswordSuccess(null);

    const fullName = String(form.full_name || "").trim();
    const email = String(form.email || "").trim();
    const password = String(form.password || "");
    const confirmPassword = String(form.confirmPassword || "");

    if (!email) {
      setError({ code: "VALIDATION_ERROR", message: "Informe o email." });
      return;
    }
    if (password.length < 8) {
      setError({ code: "VALIDATION_ERROR", message: "A senha deve ter pelo menos 8 caracteres." });
      return;
    }
    if (password !== confirmPassword) {
      setError({ code: "VALIDATION_ERROR", message: "A confirmação de senha não confere." });
      return;
    }

    setSubmitting(true);
    const res = await api.post("/auth/register", {
      email,
      password,
      full_name: fullName || null
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setForm(INITIAL_FORM);
    setSuccess(res.data);
    await refreshUsersAndAccess();
  };

  const bookNameById = useMemo(() => {
    const map = {};
    books.forEach((book) => {
      map[book.id] = book.name || book.id;
    });
    return map;
  }, [books]);

  const setAccessForm = (userId, patch) => {
    setAccessFormByUser((current) => {
      const base = current[userId] || { book_id: books[0]?.id || "", role: DEFAULT_ACCESS_ROLE };
      return {
        ...current,
        [userId]: {
          book_id: patch.book_id !== undefined ? patch.book_id : base.book_id,
          role: patch.role !== undefined ? normalizeRole(patch.role) : normalizeRole(base.role)
        }
      };
    });
  };

  const setResetPasswordForm = (userId, patch) => {
    setResetPasswordFormByUser((current) => {
      const base = current[userId] || INITIAL_RESET_PASSWORD_FORM;
      return {
        ...current,
        [userId]: {
          newPassword: patch.newPassword !== undefined ? patch.newPassword : base.newPassword,
          confirmPassword: patch.confirmPassword !== undefined ? patch.confirmPassword : base.confirmPassword
        }
      };
    });
  };

  const handleGrantAccess = async (userId) => {
    setAccessError(null);
    setAccessSuccess(null);

    const payload = accessFormByUser[userId] || { book_id: "", role: DEFAULT_ACCESS_ROLE };
    const bookId = String(payload.book_id || "").trim();
    const role = normalizeRole(payload.role);
    if (!bookId) {
      setAccessError({ code: "VALIDATION_ERROR", message: "Selecione o livro para conceder acesso." });
      return;
    }

    setAccessBusyByUser((current) => ({ ...current, [userId]: true }));
    const res = await api.put(`/auth/users/${userId}/books/${bookId}`, { role });
    setAccessBusyByUser((current) => ({ ...current, [userId]: false }));
    if (!res.ok) {
      setAccessError(res.error);
      return;
    }

    await loadUserAccess(userId);
    setAccessSuccess({
      userId,
      message: `Acesso ${role} salvo para o livro ${bookNameById[bookId] || bookId}.`
    });
  };

  const handleRevokeAccess = async (userId, bookId) => {
    setAccessError(null);
    setAccessSuccess(null);

    const label = bookNameById[bookId] || bookId;
    const shouldContinue =
      typeof window === "undefined" ? true : window.confirm(`Remover acesso do usuário ao livro "${label}"?`);
    if (!shouldContinue) return;

    setAccessBusyByUser((current) => ({ ...current, [userId]: true }));
    const res = await api.del(`/auth/users/${userId}/books/${bookId}`);
    setAccessBusyByUser((current) => ({ ...current, [userId]: false }));
    if (!res.ok) {
      setAccessError(res.error);
      return;
    }

    await loadUserAccess(userId);
    setAccessSuccess({
      userId,
      message: `Acesso removido do livro ${label}.`
    });
  };

  const handleResetPassword = async (user) => {
    setPasswordError(null);
    setPasswordSuccess(null);
    setError(null);
    setSuccess(null);

    const payload = resetPasswordFormByUser[user.id] || INITIAL_RESET_PASSWORD_FORM;
    const newPassword = String(payload.newPassword || "");
    const confirmPassword = String(payload.confirmPassword || "");
    if (newPassword.length < 8) {
      setPasswordError({ code: "VALIDATION_ERROR", message: "A nova senha deve ter pelo menos 8 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError({ code: "VALIDATION_ERROR", message: "A confirmação de senha não confere." });
      return;
    }

    const shouldContinue =
      typeof window === "undefined"
        ? true
        : window.confirm(`Redefinir senha do usuário "${user.email}"?`);
    if (!shouldContinue) return;

    setResetPasswordBusyByUser((current) => ({ ...current, [user.id]: true }));
    const res = await api.post(`/auth/users/${user.id}/reset-password`, { new_password: newPassword });
    setResetPasswordBusyByUser((current) => ({ ...current, [user.id]: false }));
    if (!res.ok) {
      setPasswordError(res.error);
      return;
    }

    setResetPasswordFormByUser((current) => ({
      ...current,
      [user.id]: INITIAL_RESET_PASSWORD_FORM
    }));
    setPasswordSuccess(`Senha redefinida para ${user.email}.`);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Usuários</h2>
          <div className="small-muted">Cadastre usuários, senha e acesso por livro.</div>
        </div>
      </div>

      <form className="row g-3 align-items-end mb-3" onSubmit={submit}>
        <div className="col-md-4">
          <label className="form-label">Nome</label>
          <input
            className="form-control"
            value={form.full_name}
            onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
            placeholder="Administrador"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">E-mail</label>
          <input
            className="form-control"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="admin@empresa.com"
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Senha</label>
          <input
            className="form-control"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="********"
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Confirmar senha</label>
          <input
            className="form-control"
            type="password"
            required
            minLength={8}
            value={form.confirmPassword}
            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            placeholder="********"
          />
        </div>
        <div className="col-12 d-flex justify-content-end">
          <button className="btn btn-accent" type="submit" disabled={submitting}>
            {submitting ? "Salvando..." : "Cadastrar usuário"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error.code ? `${error.code}: ` : ""}
          {error.message || "Falha ao cadastrar usuário."}
        </div>
      ) : null}

      {success ? (
        <div className="alert alert-success" role="alert">
          Usuário <strong>{success.email}</strong> cadastrado com sucesso.
        </div>
      ) : null}

      {accessError ? (
        <div className="alert alert-danger" role="alert">
          {accessError.code ? `${accessError.code}: ` : ""}
          {accessError.message || "Falha ao atualizar acesso por livro."}
        </div>
      ) : null}

      {accessSuccess ? (
        <div className="alert alert-success" role="alert">
          {accessSuccess.message}
        </div>
      ) : null}

      {passwordError ? (
        <div className="alert alert-danger" role="alert">
          {passwordError.code ? `${passwordError.code}: ` : ""}
          {passwordError.message || "Falha ao redefinir senha do usuário."}
        </div>
      ) : null}

      {passwordSuccess ? (
        <div className="alert alert-success" role="alert">
          {passwordSuccess}
        </div>
      ) : null}

      <div className="d-flex align-items-center justify-content-between mb-2">
        <h5 className="mb-0">Usuários cadastrados</h5>
        <button
          className="btn btn-sm btn-outline-secondary"
          type="button"
          onClick={refreshUsersAndAccess}
          disabled={loading}
        >
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Ativo</th>
              <th>Perfil</th>
              <th>Senha</th>
              <th>Acesso a livros</th>
              <th>Criado em</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td className="small-muted" colSpan={7}>
                  {loading ? "Carregando usuários..." : "Nenhum usuário cadastrado."}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name || "-"}</td>
                  <td>{user.email}</td>
                  <td>
                    {user.is_active ? (
                      <span className="badge text-bg-success">Ativo</span>
                    ) : (
                      <span className="badge text-bg-secondary">Inativo</span>
                    )}
                  </td>
                  <td>{user.is_superuser ? "Superusuário" : "Padrão"}</td>
                  <td style={{ minWidth: "280px" }}>
                    <div className="d-flex gap-2 flex-wrap align-items-center">
                      <input
                        className="form-control form-control-sm"
                        style={{ maxWidth: "180px" }}
                        type="password"
                        minLength={8}
                        value={resetPasswordFormByUser[user.id]?.newPassword || ""}
                        onChange={(event) => setResetPasswordForm(user.id, { newPassword: event.target.value })}
                        placeholder="Nova senha"
                        disabled={Boolean(resetPasswordBusyByUser[user.id])}
                      />
                      <input
                        className="form-control form-control-sm"
                        style={{ maxWidth: "180px" }}
                        type="password"
                        minLength={8}
                        value={resetPasswordFormByUser[user.id]?.confirmPassword || ""}
                        onChange={(event) => setResetPasswordForm(user.id, { confirmPassword: event.target.value })}
                        placeholder="Confirmar senha"
                        disabled={Boolean(resetPasswordBusyByUser[user.id])}
                      />
                      <button
                        className="btn btn-sm btn-outline-warning"
                        type="button"
                        onClick={() => handleResetPassword(user)}
                        disabled={Boolean(resetPasswordBusyByUser[user.id])}
                      >
                        {resetPasswordBusyByUser[user.id] ? "Salvando..." : "Redefinir"}
                      </button>
                    </div>
                  </td>
                  <td style={{ minWidth: "360px" }}>
                    {user.is_superuser ? (
                      <span className="small-muted">Acesso total (superusuário).</span>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        <div className="d-flex flex-column gap-1">
                          {(accessByUser[user.id] || []).length === 0 ? (
                            <span className="small-muted">Sem livros atribuídos.</span>
                          ) : (
                            (accessByUser[user.id] || []).map((access) => (
                              <div key={`${access.user_id}:${access.book_id}`} className="d-flex gap-2 align-items-center">
                                <span className="badge text-bg-light border">
                                  {bookNameById[access.book_id] || access.book_id} · {access.role}
                                </span>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  type="button"
                                  onClick={() => handleRevokeAccess(user.id, access.book_id)}
                                  disabled={Boolean(accessBusyByUser[user.id])}
                                >
                                  Remover
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="d-flex gap-2 flex-wrap align-items-center">
                          <select
                            className="form-select form-select-sm"
                            style={{ maxWidth: "180px" }}
                            value={accessFormByUser[user.id]?.book_id || ""}
                            onChange={(event) => setAccessForm(user.id, { book_id: event.target.value })}
                            disabled={books.length === 0 || Boolean(accessBusyByUser[user.id])}
                          >
                            <option value="">Selecione o livro</option>
                            {books.map((book) => (
                              <option key={book.id} value={book.id}>
                                {book.name || book.id}
                              </option>
                            ))}
                          </select>
                          <select
                            className="form-select form-select-sm"
                            style={{ maxWidth: "130px" }}
                            value={normalizeRole(accessFormByUser[user.id]?.role || DEFAULT_ACCESS_ROLE)}
                            onChange={(event) => setAccessForm(user.id, { role: event.target.value })}
                            disabled={Boolean(accessBusyByUser[user.id])}
                          >
                            <option value="VIEWER">VIEWER</option>
                            <option value="EDITOR">EDITOR</option>
                          </select>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            type="button"
                            onClick={() => handleGrantAccess(user.id)}
                            disabled={Boolean(accessBusyByUser[user.id])}
                          >
                            {accessBusyByUser[user.id] ? "Salvando..." : "Conceder / atualizar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td>{formatCreatedAt(user.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
