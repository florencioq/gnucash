import React, { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

const INITIAL_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

export default function ChangePasswordPage({ currentUser = null }) {
  const formAnchorRef = useRef(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    formAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const currentPassword = String(form.currentPassword || "");
    const newPassword = String(form.newPassword || "");
    const confirmPassword = String(form.confirmPassword || "");

    if (!currentPassword) {
      setError({ code: "VALIDATION_ERROR", message: "Informe a senha atual." });
      return;
    }
    if (newPassword.length < 8) {
      setError({ code: "VALIDATION_ERROR", message: "A nova senha deve ter pelo menos 8 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setError({ code: "VALIDATION_ERROR", message: "A confirmação de senha não confere." });
      return;
    }
    if (currentPassword === newPassword) {
      setError({ code: "VALIDATION_ERROR", message: "A nova senha deve ser diferente da senha atual." });
      return;
    }

    setSubmitting(true);
    const res = await api.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setForm(INITIAL_FORM);
    setSuccess(true);
  };

  return (
    <div ref={formAnchorRef}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Alterar senha</h2>
          <div className="small-muted">
            {currentUser?.email ? `Usuário: ${currentUser.email}` : "Atualize sua senha de acesso."}
          </div>
        </div>
      </div>

      <form className="row g-3 align-items-end" onSubmit={handleSubmit}>
        <div className="col-md-4">
          <label className="form-label">Senha atual</label>
          <input
            className="form-control"
            type="password"
            required
            value={form.currentPassword}
            onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))}
            placeholder="********"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nova senha</label>
          <input
            className="form-control"
            type="password"
            required
            minLength={8}
            value={form.newPassword}
            onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))}
            placeholder="********"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Confirmar nova senha</label>
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
            {submitting ? "Salvando..." : "Atualizar senha"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="alert alert-danger mt-3 mb-0" role="alert">
          {error.code ? `${error.code}: ` : ""}
          {error.message || "Falha ao atualizar senha."}
        </div>
      ) : null}

      {success ? (
        <div className="alert alert-success mt-3 mb-0" role="alert">
          Senha atualizada com sucesso.
        </div>
      ) : null}
    </div>
  );
}
