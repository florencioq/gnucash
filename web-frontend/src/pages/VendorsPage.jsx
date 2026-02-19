import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import useActiveBook from "../hooks/useActiveBook.js";

function emptyToNull(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function filterTree(nodes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const visit = (node) => {
    const selfMatch =
      (node.name || "").toLowerCase().includes(q) ||
      (node.type || "").toLowerCase().includes(q);
    const children = (node.children || []).map(visit).filter(Boolean);
    if (selfMatch || children.length > 0) {
      return { ...node, children };
    }
    return null;
  };

  return nodes.map(visit).filter(Boolean);
}

function keepTypeBranches(nodes, allowedTypes) {
  const visit = (node) => {
    const children = (node.children || []).map(visit).filter(Boolean);
    if (node.type === "ROOT") {
      return children.length > 0 ? { ...node, children } : null;
    }
    if (allowedTypes.has(node.type) || children.length > 0) {
      return { ...node, children };
    }
    return null;
  };

  return nodes.map(visit).filter(Boolean);
}

function reverseAccountPath(path) {
  const parts = String(path || "")
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return String(path || "");
  return parts.reverse().join(" / ");
}

export default function VendorsPage() {
  const VENDOR_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const [commodities, setCommodities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountTree, setAccountTree] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorActiveFilter, setVendorActiveFilter] = useState("ALL");
  const [vendorSortDirection, setVendorSortDirection] = useState("asc");
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorPageSize, setVendorPageSize] = useState(25);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [expensePickerOpen, setExpensePickerOpen] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [editingGuid, setEditingGuid] = useState("");
  const [error, setError] = useState(null);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();
  const [form, setForm] = useState({
    name: "",
    id: "",
    currency_guid: "",
    notes: "",
    expense_account_guid: "",
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
  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );
  const accountFullNameById = useMemo(() => {
    const cache = new Map();

    const build = (accountId, visited = new Set()) => {
      if (cache.has(accountId)) return cache.get(accountId);
      if (visited.has(accountId)) return accountsById.get(accountId)?.name || accountId;
      visited.add(accountId);

      const account = accountsById.get(accountId);
      if (!account) return accountId;
      if (account.type === "ROOT" || !account.parent_id) {
        cache.set(accountId, account.name);
        return account.name;
      }

      const parent = accountsById.get(account.parent_id);
      if (!parent) {
        cache.set(accountId, account.name);
        return account.name;
      }

      const parentName = build(account.parent_id, visited);
      const fullName =
        parent.type === "ROOT"
          ? account.name
          : `${parentName} / ${account.name}`;
      cache.set(accountId, fullName);
      return fullName;
    };

    for (const account of accounts) {
      build(account.id);
    }

    return cache;
  }, [accounts, accountsById]);
  const selectedExpenseAccount = accountsById.get(form.expense_account_guid) || null;
  const selectedExpenseAccountPath = selectedExpenseAccount
    ? accountFullNameById.get(selectedExpenseAccount.id) || selectedExpenseAccount.name
    : "";
  const expenseAccountLabel = selectedExpenseAccount
    ? `${reverseAccountPath(selectedExpenseAccountPath)} (${selectedExpenseAccount.type})`
    : "Selecione a conta de despesa";
  const expenseTree = useMemo(
    () => keepTypeBranches(accountTree, new Set(["EXPENSE"])),
    [accountTree]
  );
  const visibleExpenseTree = useMemo(
    () => filterTree(expenseTree, expenseSearch),
    [expenseTree, expenseSearch]
  );
  const filteredSortedVendors = useMemo(() => {
    const query = vendorSearch.trim().toLowerCase();
    const withSearch = vendors.filter((vendor) => {
      if (!query) return true;
      return String(vendor.name || "").toLowerCase().includes(query);
    });

    const withStatus = withSearch.filter((vendor) => {
      if (vendorActiveFilter === "ALL") return true;
      if (vendorActiveFilter === "ACTIVE") return Boolean(vendor.active);
      return !vendor.active;
    });

    return [...withStatus].sort((left, right) => {
      const leftName = String(left.name || "").toLowerCase();
      const rightName = String(right.name || "").toLowerCase();
      if (leftName === rightName) {
        const leftGuid = String(left.guid || "");
        const rightGuid = String(right.guid || "");
        return vendorSortDirection === "asc"
          ? leftGuid.localeCompare(rightGuid)
          : rightGuid.localeCompare(leftGuid);
      }
      return vendorSortDirection === "asc"
        ? leftName.localeCompare(rightName)
        : rightName.localeCompare(leftName);
    });
  }, [vendors, vendorSearch, vendorActiveFilter, vendorSortDirection]);
  const totalVendorItems = filteredSortedVendors.length;
  const totalVendorPages = totalVendorItems === 0 ? 1 : Math.ceil(totalVendorItems / vendorPageSize);
  const currentVendorPage = totalVendorItems === 0 ? 1 : Math.min(vendorPage, totalVendorPages);
  const pagedVendors = useMemo(() => {
    const startIndex = (currentVendorPage - 1) * vendorPageSize;
    return filteredSortedVendors.slice(startIndex, startIndex + vendorPageSize);
  }, [filteredSortedVendors, currentVendorPage, vendorPageSize]);
  const vendorSortIndicator = vendorSortDirection === "asc" ? "↑" : "↓";

  const resetForm = (currencyGuid = "") => {
    setForm({
      name: "",
      id: "",
      currency_guid: currencyGuid,
      notes: "",
      expense_account_guid: "",
      active: true,
      tax_override: false,
      addr_name: "",
      addr_phone: "",
      addr_email: "",
      tax_inc: ""
    });
  };

  const closeVendorModal = () => {
    setVendorModalOpen(false);
    setExpensePickerOpen(false);
    setExpenseSearch("");
  };

  const openCreateVendorModal = () => {
    setEditingGuid("");
    resetForm(form.currency_guid || (commodities[0] || {}).id || "");
    setError(null);
    setVendorModalOpen(true);
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

  const loadAccounts = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/accounts?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setAccounts(res.data.filter((account) => account.type !== "ROOT"));
  };

  const loadAccountTree = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/accounts/tree?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setAccountTree(res.data);
  };

  useEffect(() => {
    loadCommodities();
  }, []);

  useEffect(() => {
    if (activeBookId) {
      loadVendors(activeBookId);
      loadAccounts(activeBookId);
      loadAccountTree(activeBookId);
      setEditingGuid("");
      return;
    }
    setVendors([]);
    setAccounts([]);
    setAccountTree([]);
    setExpensePickerOpen(false);
    setExpenseSearch("");
    setEditingGuid("");
  }, [activeBookId]);

  useEffect(() => {
    setExpensePickerOpen(false);
    setExpenseSearch("");
  }, [editingGuid, accountTree]);

  useEffect(() => {
    setVendorPage(1);
  }, [vendorSearch, vendorActiveFilter, vendorSortDirection, vendorPageSize]);

  const selectExpenseAccount = (accountId) => {
    setForm((current) => ({ ...current, expense_account_guid: accountId }));
    setExpenseSearch("");
    setExpensePickerOpen(false);
  };

  const toggleExpensePicker = () => {
    setExpensePickerOpen((current) => {
      const next = !current;
      if (next) setExpenseSearch("");
      return next;
    });
  };

  const renderExpenseTreeNodes = (nodes, depth = 0) => {
    return nodes.map((node) => {
      if (node.type === "ROOT") {
        return (
          <div key={node.id}>
            {node.children && node.children.length > 0
              ? renderExpenseTreeNodes(node.children, depth)
              : null}
          </div>
        );
      }

      const selected = form.expense_account_guid === node.id;
      const selectable = node.type === "EXPENSE" && !node.is_placeholder;

      return (
        <div key={node.id}>
          <button
            type="button"
            className={`counter-tree-node ${selected ? "is-selected" : ""}`}
            style={{ marginLeft: `${depth * 14}px` }}
            disabled={!selectable}
            onClick={() => {
              if (selectable) selectExpenseAccount(node.id);
            }}
          >
            <span className="counter-tree-name">{node.name}</span>
            <span className="badge badge-soft text-uppercase">{node.type}</span>
            {node.is_placeholder ? <span className="small-muted">marcador</span> : null}
          </button>
          {node.children && node.children.length > 0
            ? renderExpenseTreeNodes(node.children, depth + 1)
            : null}
        </div>
      );
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!activeBookId) return;

    const payload = {
      name: form.name.trim(),
      id: form.id.trim(),
      currency_guid: form.currency_guid,
      notes: form.notes,
      expense_account_guid: emptyToNull(form.expense_account_guid),
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
    closeVendorModal();
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
      expense_account_guid: vendor.expense_account_guid || "",
      active: Boolean(vendor.active),
      tax_override: Boolean(vendor.tax_override),
      addr_name: vendor.addr_name || "",
      addr_phone: vendor.addr_phone || "",
      addr_email: vendor.addr_email || "",
      tax_inc: vendor.tax_inc || ""
    });
    setVendorModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingGuid("");
    resetForm(form.currency_guid || (commodities[0] || {}).id || "");
    closeVendorModal();
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
          <h2 className="mb-1">Fornecedores</h2>
          <div className="small-muted">Cadastro de fornecedores no estilo IgeosCash.</div>
        </div>
        <button className="btn btn-accent" type="button" onClick={openCreateVendorModal} disabled={!activeBookId}>
          Novo fornecedor
        </button>
      </div>

      {activeBook ? (
        <div className="small-muted mb-3">Livro ativo: {activeBook.name || activeBook.id}</div>
      ) : (
        <div className="alert alert-warning" role="alert">
          Nenhum livro ativo. Defina um em Livros para continuar.
        </div>
      )}

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

      <div className="row g-2 align-items-end mb-3 mt-2">
        <div className="col-md-4">
          <label className="form-label">Buscar fornecedor</label>
          <input
            className="form-control"
            value={vendorSearch}
            onChange={(event) => setVendorSearch(event.target.value)}
            placeholder="Digite o nome"
            disabled={!activeBookId}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Filtro de status</label>
          <select
            className="form-select"
            value={vendorActiveFilter}
            onChange={(event) => setVendorActiveFilter(event.target.value)}
            disabled={!activeBookId}
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Ativos</option>
            <option value="INACTIVE">Inativos</option>
          </select>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  className="table-sort-btn"
                  onClick={() => setVendorSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
                >
                  Nome {vendorSortIndicator}
                </button>
              </th>
              <th>ID</th>
              <th>Moeda</th>
              <th>E-mail</th>
              <th>Telefone</th>
              <th>Conta Despesa</th>
              <th>Ativo</th>
              <th>GUID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagedVendors.length === 0 ? (
              <tr>
                <td colSpan={9} className="small-muted">
                  Nenhum fornecedor encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              pagedVendors.map((vendor) => (
                <tr key={vendor.guid}>
                  <td className="fw-semibold">{vendor.name}</td>
                  <td>{vendor.id}</td>
                  <td>{commoditiesById.get(vendor.currency_guid)?.mnemonic || vendor.currency_guid}</td>
                  <td>{vendor.addr_email || "-"}</td>
                  <td>{vendor.addr_phone || "-"}</td>
                  <td>
                    {vendor.expense_account_guid
                      ? accountFullNameById.get(vendor.expense_account_guid) ||
                        accountsById.get(vendor.expense_account_guid)?.name ||
                        vendor.expense_account_guid
                      : "-"}
                  </td>
                  <td>{vendor.active ? "Sim" : "Não"}</td>
                  <td className="small-muted">{vendor.guid}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-secondary me-2"
                      type="button"
                      onClick={() => startEdit(vendor)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      type="button"
                      onClick={() => remove(vendor.guid)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
        <div className="small-muted">
          Mostrando {pagedVendors.length} de {totalVendorItems} fornecedores
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="form-label mb-0 small-muted">Itens por página</label>
          <select
            className="form-select form-select-sm"
            value={vendorPageSize}
            onChange={(event) => setVendorPageSize(Number(event.target.value) || 25)}
            disabled={!activeBookId}
            style={{ width: "96px" }}
          >
            {VENDOR_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setVendorPage(1)}
            disabled={!activeBookId || currentVendorPage <= 1}
          >
            Primeira
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setVendorPage((current) => Math.max(1, current - 1))}
            disabled={!activeBookId || currentVendorPage <= 1}
          >
            Anterior
          </button>
          <span className="small-muted">
            Página {totalVendorItems === 0 ? 0 : currentVendorPage} de {totalVendorItems === 0 ? 0 : totalVendorPages}
          </span>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setVendorPage((current) => Math.min(totalVendorPages, current + 1))}
            disabled={!activeBookId || currentVendorPage >= totalVendorPages || totalVendorItems === 0}
          >
            Próxima
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setVendorPage(totalVendorPages)}
            disabled={!activeBookId || currentVendorPage >= totalVendorPages || totalVendorItems === 0}
          >
            Última
          </button>
        </div>
      </div>

      {vendorModalOpen ? (
        <div className="modal d-block vendor-modal" tabIndex={-1} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-xl vendor-modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingGuid ? "Editar fornecedor" : "Novo fornecedor"}</h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={cancelEdit} />
              </div>
              <form className="modal-body" onSubmit={submit}>
                <div className="row g-2 align-items-end">
                  <div className="col-md-3">
                    <label className="form-label">Nome</label>
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
                    <label className="form-label">Moeda</label>
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
                    <label className="form-label">Ativo</label>
                    <select
                      className="form-select"
                      value={form.active ? "true" : "false"}
                      onChange={(event) => setForm({ ...form, active: event.target.value === "true" })}
                    >
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Notas</label>
                    <input
                      className="form-control"
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Sobrescrever imposto</label>
                    <select
                      className="form-select"
                      value={form.tax_override ? "true" : "false"}
                      onChange={(event) => setForm({ ...form, tax_override: event.target.value === "true" })}
                    >
                      <option value="false">Não</option>
                      <option value="true">Sim</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Nome do endereço</label>
                    <input
                      className="form-control"
                      value={form.addr_name}
                      onChange={(event) => setForm({ ...form, addr_name: event.target.value })}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Telefone do endereço</label>
                    <input
                      className="form-control"
                      value={form.addr_phone}
                      onChange={(event) => setForm({ ...form, addr_phone: event.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">E-mail do endereço</label>
                    <input
                      className="form-control"
                      value={form.addr_email}
                      onChange={(event) => setForm({ ...form, addr_email: event.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Inclui imposto</label>
                    <input
                      className="form-control"
                      value={form.tax_inc}
                      onChange={(event) => setForm({ ...form, tax_inc: event.target.value })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Conta de Despesa Padrão</label>
                    <div className="tree-select">
                      <button
                        type="button"
                        className="form-select tree-select-toggle"
                        onClick={toggleExpensePicker}
                      >
                        <span
                          className="tree-select-label"
                          title={
                            selectedExpenseAccount
                              ? `${selectedExpenseAccountPath} (${selectedExpenseAccount.type})`
                              : expenseAccountLabel
                          }
                        >
                          {expenseAccountLabel}
                        </span>
                        <span className="tree-select-caret">{expensePickerOpen ? "▲" : "▼"}</span>
                      </button>
                      {expensePickerOpen ? (
                        <div className="tree-select-menu">
                          <input
                            className="form-control mb-2"
                            value={expenseSearch}
                            onChange={(event) => setExpenseSearch(event.target.value)}
                            placeholder="Filtrar conta de despesa"
                          />
                          <div className="counter-tree-panel">
                            {visibleExpenseTree.length > 0 ? (
                              renderExpenseTreeNodes(visibleExpenseTree)
                            ) : (
                              <div className="small-muted">Nenhuma conta de despesa encontrada para o filtro.</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="modal-footer px-0 pb-0 mt-3">
                  <button className="btn btn-outline-secondary" type="button" onClick={cancelEdit}>
                    Cancelar
                  </button>
                  <button className="btn btn-accent" type="submit" disabled={!activeBookId}>
                    {editingGuid ? "Salvar fornecedor" : "Criar fornecedor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
      {vendorModalOpen ? <div className="modal-backdrop show" /> : null}
    </div>
  );
}
