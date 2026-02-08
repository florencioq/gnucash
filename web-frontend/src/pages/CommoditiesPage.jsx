import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function CommoditiesPage() {
  const [commodities, setCommodities] = useState([]);
  const [form, setForm] = useState({
    namespace: "CURRENCY",
    mnemonic: "",
    fullname: "",
    fraction: 100,
    quote: false
  });
  const [namespaceFilter, setNamespaceFilter] = useState("CURRENCY");
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState({});

  const load = async (namespace = namespaceFilter) => {
    const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : "";
    const res = await api.get(`/commodities${query}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setCommodities(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (event) => {
    event.preventDefault();
    const payload = {
      namespace: form.namespace,
      mnemonic: form.mnemonic,
      fullname: form.fullname || null,
      fraction: Number(form.fraction) || 1,
      quote: Boolean(form.quote)
    };
    const res = await api.post("/commodities", payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setForm({ ...form, mnemonic: "", fullname: "", fraction: 100, quote: false });
    await load();
  };

  const remove = async (commodityId) => {
    const res = await api.del(`/commodities/${commodityId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await load();
  };

  const startEdit = (commodity) => {
    setEditing({
      ...editing,
      [commodity.id]: {
        namespace: commodity.namespace,
        mnemonic: commodity.mnemonic,
        fullname: commodity.fullname || "",
        fraction: commodity.fraction,
        quote: commodity.quote
      }
    });
  };

  const saveEdit = async (commodity) => {
    const draft = editing[commodity.id];
    const payload = {
      namespace: draft.namespace,
      mnemonic: draft.mnemonic,
      fullname: draft.fullname || null,
      fraction: Number(draft.fraction) || 1,
      quote: Boolean(draft.quote)
    };
    const res = await api.patch(`/commodities/${commodity.id}`, payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing((prev) => {
      const next = { ...prev };
      delete next[commodity.id];
      return next;
    });
    await load();
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Commodities</h2>
          <div className="small-muted">Manage currencies and commodities.</div>
        </div>
      </div>

      <form className="row g-2 align-items-end mb-4" onSubmit={create}>
        <div className="col-md-3">
          <label className="form-label">Namespace</label>
          <input
            className="form-control"
            value={form.namespace}
            onChange={(event) => setForm({ ...form, namespace: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Mnemonic</label>
          <input
            className="form-control"
            value={form.mnemonic}
            onChange={(event) => setForm({ ...form, mnemonic: event.target.value })}
            required
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Full name</label>
          <input
            className="form-control"
            value={form.fullname}
            onChange={(event) => setForm({ ...form, fullname: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Fraction</label>
          <input
            type="number"
            min="1"
            className="form-control"
            value={form.fraction}
            onChange={(event) => setForm({ ...form, fraction: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Quote</label>
          <select
            className="form-select"
            value={form.quote ? "true" : "false"}
            onChange={(event) => setForm({ ...form, quote: event.target.value === "true" })}
          >
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        </div>
        <div className="col-md-3">
          <button className="btn btn-accent w-100" type="submit">
            Create Commodity
          </button>
        </div>
      </form>

      <div className="row g-2 align-items-end mb-3">
        <div className="col-md-3">
          <label className="form-label">Filter namespace</label>
          <input
            className="form-control"
            value={namespaceFilter}
            onChange={(event) => setNamespaceFilter(event.target.value)}
          />
        </div>
        <div className="col-md-2">
          <button className="btn btn-outline-secondary w-100" type="button" onClick={() => load()}>
            Apply
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error.code}: {error.message}
        </div>
      ) : null}

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th>Namespace</th>
              <th>Mnemonic</th>
              <th>Full name</th>
              <th>Fraction</th>
              <th>Quote</th>
              <th>ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {commodities.map((commodity) => (
              <tr key={commodity.id}>
                <td>
                  {editing[commodity.id] ? (
                    <input
                      className="form-control"
                      value={editing[commodity.id].namespace}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          [commodity.id]: {
                            ...editing[commodity.id],
                            namespace: event.target.value
                          }
                        })
                      }
                    />
                  ) : (
                    commodity.namespace
                  )}
                </td>
                <td>
                  {editing[commodity.id] ? (
                    <input
                      className="form-control"
                      value={editing[commodity.id].mnemonic}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          [commodity.id]: {
                            ...editing[commodity.id],
                            mnemonic: event.target.value
                          }
                        })
                      }
                    />
                  ) : (
                    commodity.mnemonic
                  )}
                </td>
                <td>
                  {editing[commodity.id] ? (
                    <input
                      className="form-control"
                      value={editing[commodity.id].fullname}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          [commodity.id]: {
                            ...editing[commodity.id],
                            fullname: event.target.value
                          }
                        })
                      }
                    />
                  ) : (
                    commodity.fullname || "-"
                  )}
                </td>
                <td>
                  {editing[commodity.id] ? (
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={editing[commodity.id].fraction}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          [commodity.id]: {
                            ...editing[commodity.id],
                            fraction: event.target.value
                          }
                        })
                      }
                    />
                  ) : (
                    commodity.fraction
                  )}
                </td>
                <td>
                  {editing[commodity.id] ? (
                    <select
                      className="form-select"
                      value={editing[commodity.id].quote ? "true" : "false"}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          [commodity.id]: {
                            ...editing[commodity.id],
                            quote: event.target.value === "true"
                          }
                        })
                      }
                    >
                      <option value="false">False</option>
                      <option value="true">True</option>
                    </select>
                  ) : commodity.quote ? (
                    "True"
                  ) : (
                    "False"
                  )}
                </td>
                <td className="small-muted">{commodity.id}</td>
                <td className="text-end">
                  {editing[commodity.id] ? (
                    <button
                      className="btn btn-sm btn-outline-success me-2"
                      onClick={() => saveEdit(commodity)}
                      type="button"
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-outline-secondary me-2"
                      onClick={() => startEdit(commodity)}
                      type="button"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => remove(commodity.id)}
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
