import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";

function emptyToNull(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

export default function VendorsPage() {
  const [commodities, setCommodities] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [editingGuid, setEditingGuid] = useState("");
  const [error, setError] = useState(null);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();
  const [form, setForm] = useState({
    name: "",
    id: "",
    currency_guid: "",
    notes: "",
    active: true,
    tax_override: false,
    addr_name: "",
    addr_phone: "",
    addr_email: "",
    tax_inc: ""
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
      tax_override: false,
      addr_name: "",
      addr_phone: "",
      addr_email: "",
      tax_inc: ""
    });
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

  const loadVendors = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/vendors?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setVendors(res.data);
  };

  useEffect(() => {
    loadCommodities();
  }, []);

  useEffect(() => {
    if (activeBookId) {
      loadVendors(activeBookId);
      setEditingGuid("");
    }
  }, [activeBookId]);

  const submit = async (event) => {
    event.preventDefault();
    if (!activeBookId) return;

    const payload = {
      name: form.name.trim(),
      id: form.id.trim(),
      currency_guid: form.currency_guid,
      notes: form.notes,
      active: Boolean(form.active),
      tax_override: Boolean(form.tax_override),
      addr_name: emptyToNull(form.addr_name),
      addr_phone: emptyToNull(form.addr_phone),
      addr_email: emptyToNull(form.addr_email),
      tax_inc: emptyToNull(form.tax_inc)
    };
    if (!editingGuid) {
      payload.book_id = activeBookId;
    }

    const res = editingGuid
      ? await api.patch(`/vendors/${editingGuid}`, payload)
      : await api.post("/vendors", payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setEditingGuid("");
    resetForm(form.currency_guid);
    await loadVendors(activeBookId);
  };

  const startEdit = (vendor) => {
    setError(null);
    setEditingGuid(vendor.guid);
    setForm({
      name: vendor.name || "",
      id: vendor.id || "",
      currency_guid: vendor.currency_guid || "",
      notes: vendor.notes || "",
      active: Boolean(vendor.active),
      tax_override: Boolean(vendor.tax_override),
      addr_name: vendor.addr_name || "",
      addr_phone: vendor.addr_phone || "",
      addr_email: vendor.addr_email || "",
      tax_inc: vendor.tax_inc || ""
    });
  };

  const cancelEdit = () => {
    setEditingGuid("");
    resetForm(form.currency_guid || (commodities[0] || {}).id || "");
  };

  const remove = async (vendorGuid) => {
    const res = await api.del(`/vendors/${vendorGuid}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (editingGuid === vendorGuid) {
      cancelEdit();
    }
    await loadVendors(activeBookId);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Vendors</h2>
          <div className="small-muted">Cadastro de fornecedores no estilo GnuCash.</div>
        </div>
      </div>

      {activeBook ? (
        <div className="small-muted mb-3">Book ativo: {activeBook.name || activeBook.id}</div>
      ) : (
        <div className="alert alert-warning" role="alert">
          Nenhum book ativo. Defina um em Books para continuar.
        </div>
      )}

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
          <label className="form-label">Tax Override</label>
          <select
            className="form-select"
            value={form.tax_override ? "true" : "false"}
            onChange={(event) => setForm({ ...form, tax_override: event.target.value === "true" })}
          >
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Address Name</label>
          <input
            className="form-control"
            value={form.addr_name}
            onChange={(event) => setForm({ ...form, addr_name: event.target.value })}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Address Phone</label>
          <input
            className="form-control"
            value={form.addr_phone}
            onChange={(event) => setForm({ ...form, addr_phone: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Address Email</label>
          <input
            className="form-control"
            value={form.addr_email}
            onChange={(event) => setForm({ ...form, addr_email: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Tax Inc</label>
          <input
            className="form-control"
            value={form.tax_inc}
            onChange={(event) => setForm({ ...form, tax_inc: event.target.value })}
          />
        </div>

        <div className="col-md-12 d-flex justify-content-end gap-2 mt-2">
          {editingGuid ? (
            <button className="btn btn-outline-secondary" type="button" onClick={cancelEdit}>
              Cancel
            </button>
          ) : null}
          <button className="btn btn-accent" type="submit" disabled={!activeBookId}>
            {editingGuid ? "Save Vendor" : "Create Vendor"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error.code}: {error.message}
        </div>
      ) : null}
      {!error && activeBookError ? (
        <div className="alert alert-danger" role="alert">
          {activeBookError.code}: {activeBookError.message}
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
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={8} className="small-muted">
                  No vendors yet.
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => (
                <tr key={vendor.guid}>
                  <td className="fw-semibold">{vendor.name}</td>
                  <td>{vendor.id}</td>
                  <td>{commoditiesById.get(vendor.currency_guid)?.mnemonic || vendor.currency_guid}</td>
                  <td>{vendor.addr_email || "-"}</td>
                  <td>{vendor.addr_phone || "-"}</td>
                  <td>{vendor.active ? "True" : "False"}</td>
                  <td className="small-muted">{vendor.guid}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-secondary me-2"
                      type="button"
                      onClick={() => startEdit(vendor)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      type="button"
                      onClick={() => remove(vendor.guid)}
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
