import React, { useState } from "react";
import { api, getAuthSession, setAuthSession } from "../api/client.js";

export default function LoginPage({ currentUser = null, onLoginSuccess = null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const hasSession = Boolean(getAuthSession());

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const loginRes = await api.post("/auth/login", {
      email: String(email || "").trim(),
      password: String(password || "")
    });
    if (!loginRes.ok) {
      setSubmitting(false);
      setError(loginRes.error);
      return;
    }

    const saved = setAuthSession(loginRes.data);
    if (!saved) {
      setSubmitting(false);
      setError({ code: "AUTH_ERROR", message: "Falha ao salvar sessão local." });
      return;
    }

    const meRes = await api.get("/auth/me");
    setSubmitting(false);
    setPassword("");

    if (!meRes.ok) {
      setError(meRes.error);
      if (typeof onLoginSuccess === "function") onLoginSuccess(null);
      return;
    }

    if (typeof onLoginSuccess === "function") onLoginSuccess(meRes.data);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Login</h2>
          <div className="small-muted">Entre para usar o sistema com autenticação.</div>
        </div>
      </div>

      {currentUser ? (
        <div className="alert alert-success" role="alert">
          Autenticado como <strong>{currentUser.full_name || currentUser.email}</strong>.
        </div>
      ) : hasSession ? (
        <div className="alert alert-info" role="alert">
          Sessão local detectada. Se necessário, entre novamente para renovar as credenciais.
        </div>
      ) : null}

      <form className="row g-3 align-items-end" onSubmit={submit}>
        <div className="col-md-5">
          <label className="form-label">Email</label>
          <input
            className="form-control"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@empresa.com"
          />
        </div>
        <div className="col-md-5">
          <label className="form-label">Senha</label>
          <input
            className="form-control"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
          />
        </div>
        <div className="col-md-2">
          <button className="btn btn-accent w-100" type="submit" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="alert alert-danger mt-3 mb-0" role="alert">
          {error.code ? `${error.code}: ` : ""}
          {error.message || "Falha de autenticação."}
        </div>
      ) : null}
    </div>
  );
}
