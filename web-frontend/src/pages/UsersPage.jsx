import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";

const INITIAL_FORM = {
  full_name: "",
  email: "",
  password: "",
  confirmPassword: ""
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const res = await api.get("/auth/users");
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setUsers(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

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
    await loadUsers();
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Usuários</h2>
          <div className="small-muted">Cadastre usuários e senha de acesso.</div>
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
          <label className="form-label">Email</label>
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

      <div className="d-flex align-items-center justify-content-between mb-2">
        <h5 className="mb-0">Usuários cadastrados</h5>
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={loadUsers} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Ativo</th>
              <th>Perfil</th>
              <th>Criado em</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td className="small-muted" colSpan={5}>
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
                  <td>{user.is_superuser ? "Superuser" : "Padrão"}</td>
                  <td>{user.created_at ? new Date(user.created_at).toLocaleString() : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
