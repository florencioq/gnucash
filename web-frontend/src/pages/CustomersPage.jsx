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

function nextCustomerId(customers) {
  const numericIds = customers
    .map((customer) => Number.parseInt(String(customer.id || ""), 10))
    .filter((value) => Number.isFinite(value));
  const next = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  return String(next).padStart(6, "0");
}

export default function CustomersPage() {
  const CUSTOMER_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const [commodities, setCommodities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountTree, setAccountTree] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerActiveFilter, setCustomerActiveFilter] = useState("ALL");
  const [customerSortDirection, setCustomerSortDirection] = useState("asc");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize, setCustomerPageSize] = useState(25);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [incomePickerOpen, setIncomePickerOpen] = useState(false);
  const [incomeSearch, setIncomeSearch] = useState("");
  const [editingGuid, setEditingGuid] = useState("");
  const [error, setError] = useState(null);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();
  const [form, setForm] = useState({
    name: "",
    id: "",
    currency_guid: "",
    notes: "",
    active: true,
    discount_num: "0",
    discount_denom: "1",
    credit_num: "0",
    credit_denom: "1",
    income_account_guid: "",
    addr_name: "",
    addr_phone: "",
    addr_email: "",
    shipaddr_name: "",
    shipaddr_phone: "",
    shipaddr_email: ""
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
  const selectedIncomeAccount = accountsById.get(form.income_account_guid) || null;
  const selectedIncomeAccountPath = selectedIncomeAccount
    ? accountFullNameById.get(selectedIncomeAccount.id) || selectedIncomeAccount.name
    : "";
  const incomeAccountLabel = selectedIncomeAccount
    ? `${reverseAccountPath(selectedIncomeAccountPath)} (${selectedIncomeAccount.type})`
    : "Selecione a conta de receita";
  const incomeTree = useMemo(
    () => keepTypeBranches(accountTree, new Set(["INCOME"])),
    [accountTree]
  );
  const visibleIncomeTree = useMemo(
    () => filterTree(incomeTree, incomeSearch),
    [incomeTree, incomeSearch]
  );
  const filteredSortedCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    const withSearch = customers.filter((customer) => {
      if (!query) return true;
      return String(customer.name || "").toLowerCase().includes(query);
    });

    const withStatus = withSearch.filter((customer) => {
      if (customerActiveFilter === "ALL") return true;
      if (customerActiveFilter === "ACTIVE") return Boolean(customer.active);
      return !customer.active;
    });

    return [...withStatus].sort((left, right) => {
      const leftName = String(left.name || "").toLowerCase();
      const rightName = String(right.name || "").toLowerCase();
      if (leftName === rightName) {
        const leftGuid = String(left.guid || "");
        const rightGuid = String(right.guid || "");
        return customerSortDirection === "asc"
          ? leftGuid.localeCompare(rightGuid)
          : rightGuid.localeCompare(leftGuid);
      }
      return customerSortDirection === "asc"
        ? leftName.localeCompare(rightName)
        : rightName.localeCompare(leftName);
    });
  }, [customers, customerSearch, customerActiveFilter, customerSortDirection]);
  const totalCustomerItems = filteredSortedCustomers.length;
  const totalCustomerPages = totalCustomerItems === 0 ? 1 : Math.ceil(totalCustomerItems / customerPageSize);
  const currentCustomerPage = totalCustomerItems === 0 ? 1 : Math.min(customerPage, totalCustomerPages);
  const pagedCustomers = useMemo(() => {
    const startIndex = (currentCustomerPage - 1) * customerPageSize;
    return filteredSortedCustomers.slice(startIndex, startIndex + customerPageSize);
  }, [filteredSortedCustomers, currentCustomerPage, customerPageSize]);
  const customerSortIndicator = customerSortDirection === "asc" ? "↑" : "↓";

  const resetForm = (currencyGuid = "") => {
    setForm({
      name: "",
      id: "",
      currency_guid: currencyGuid,
      notes: "",
      active: true,
      discount_num: "0",
      discount_denom: "1",
      credit_num: "0",
      credit_denom: "1",
      income_account_guid: "",
      addr_name: "",
      addr_phone: "",
      addr_email: "",
      shipaddr_name: "",
      shipaddr_phone: "",
      shipaddr_email: ""
    });
  };

  const closeCustomerModal = () => {
    setCustomerModalOpen(false);
    setIncomePickerOpen(false);
    setIncomeSearch("");
  };

  const openCreateCustomerModal = () => {
    setEditingGuid("");
    const currencyGuid = form.currency_guid || (commodities[0] || {}).id || "";
    setForm({
      name: "",
      id: nextCustomerId(customers),
      currency_guid: currencyGuid,
      notes: "",
      active: true,
      discount_num: "0",
      discount_denom: "1",
      credit_num: "0",
      credit_denom: "1",
      income_account_guid: "",
      addr_name: "",
      addr_phone: "",
      addr_email: "",
      shipaddr_name: "",
      shipaddr_phone: "",
      shipaddr_email: ""
    });
    setError(null);
    setCustomerModalOpen(true);
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

  const loadCustomers = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/customers?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setCustomers(res.data);
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
      loadCustomers(activeBookId);
      loadAccounts(activeBookId);
      loadAccountTree(activeBookId);
      setEditingGuid("");
      return;
    }
    setCustomers([]);
    setAccounts([]);
    setAccountTree([]);
    setIncomePickerOpen(false);
    setIncomeSearch("");
    setEditingGuid("");
    setCustomerModalOpen(false);
  }, [activeBookId]);

  useEffect(() => {
    setIncomePickerOpen(false);
    setIncomeSearch("");
  }, [editingGuid, accountTree]);

  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearch, customerActiveFilter, customerSortDirection, customerPageSize]);

  const selectIncomeAccount = (accountId) => {
    setForm((current) => ({ ...current, income_account_guid: accountId }));
    setIncomeSearch("");
    setIncomePickerOpen(false);
  };

  const toggleIncomePicker = () => {
    setIncomePickerOpen((current) => {
      const next = !current;
      if (next) setIncomeSearch("");
      return next;
    });
  };

  const renderIncomeTreeNodes = (nodes, depth = 0) => {
    return nodes.map((node) => {
      if (node.type === "ROOT") {
        return (
          <div key={node.id}>
            {node.children && node.children.length > 0
              ? renderIncomeTreeNodes(node.children, depth)
              : null}
          </div>
        );
      }

      const selected = form.income_account_guid === node.id;
      const selectable = node.type === "INCOME" && !node.is_placeholder;

      return (
        <div key={node.id}>
          <button
            type="button"
            className={`counter-tree-node ${selected ? "is-selected" : ""}`}
            style={{ marginLeft: `${depth * 14}px` }}
            disabled={!selectable}
            onClick={() => {
              if (selectable) selectIncomeAccount(node.id);
            }}
          >
            <span className="counter-tree-name">{node.name}</span>
            <span className="badge badge-soft text-uppercase">{node.type}</span>
            {node.is_placeholder ? <span className="small-muted">marcador</span> : null}
          </button>
          {node.children && node.children.length > 0
            ? renderIncomeTreeNodes(node.children, depth + 1)
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
      active: Boolean(form.active),
      discount_num: Number(form.discount_num),
      discount_denom: Number(form.discount_denom),
      credit_num: Number(form.credit_num),
      credit_denom: Number(form.credit_denom),
      income_account_guid: emptyToNull(form.income_account_guid),
      addr_name: emptyToNull(form.addr_name),
      addr_phone: emptyToNull(form.addr_phone),
      addr_email: emptyToNull(form.addr_email),
      shipaddr_name: emptyToNull(form.shipaddr_name),
      shipaddr_phone: emptyToNull(form.shipaddr_phone),
      shipaddr_email: emptyToNull(form.shipaddr_email)
    };

    if (!editingGuid) {
      payload.book_id = activeBookId;
    }

    const res = editingGuid
      ? await api.patch(`/customers/${editingGuid}`, payload)
      : await api.post("/customers", payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setEditingGuid("");
    resetForm(form.currency_guid);
    closeCustomerModal();
    await loadCustomers(activeBookId);
  };

  const startEdit = (customer) => {
    setError(null);
    setEditingGuid(customer.guid);
    setForm({
      name: customer.name || "",
      id: customer.id || "",
      currency_guid: customer.currency_guid || "",
      notes: customer.notes || "",
      active: Boolean(customer.active),
      discount_num: String(customer.discount_num ?? 0),
      discount_denom: String(customer.discount_denom ?? 1),
      credit_num: String(customer.credit_num ?? 0),
      credit_denom: String(customer.credit_denom ?? 1),
      income_account_guid: customer.income_account_guid || "",
      addr_name: customer.addr_name || "",
      addr_phone: customer.addr_phone || "",
      addr_email: customer.addr_email || "",
      shipaddr_name: customer.shipaddr_name || "",
      shipaddr_phone: customer.shipaddr_phone || "",
      shipaddr_email: customer.shipaddr_email || ""
    });
    setCustomerModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingGuid("");
    resetForm(form.currency_guid || (commodities[0] || {}).id || "");
    closeCustomerModal();
  };

  const remove = async (customerGuid) => {
    const res = await api.del(`/customers/${customerGuid}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (editingGuid === customerGuid) {
      cancelEdit();
    }
    await loadCustomers(activeBookId);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Clientes</h2>
          <div className="small-muted">Cadastro de clientes no estilo IgeosCash.</div>
        </div>
        <button className="btn btn-accent" type="button" onClick={openCreateCustomerModal} disabled={!activeBookId}>
          Novo cliente
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
          <label className="form-label">Buscar cliente</label>
          <input
            className="form-control"
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="Digite o nome"
            disabled={!activeBookId}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Filtro de status</label>
          <select
            className="form-select"
            value={customerActiveFilter}
            onChange={(event) => setCustomerActiveFilter(event.target.value)}
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
                  onClick={() => setCustomerSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
                >
                  Nome {customerSortIndicator}
                </button>
              </th>
              <th>ID</th>
              <th>Moeda</th>
              <th>E-mail</th>
              <th>Telefone</th>
              <th>Conta Receita</th>
              <th>Ativo</th>
              <th>GUID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagedCustomers.length === 0 ? (
              <tr>
                <td colSpan={9} className="small-muted">
                  Nenhum cliente encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              pagedCustomers.map((customer) => (
                <tr key={customer.guid}>
                  <td className="fw-semibold">{customer.name}</td>
                  <td>{customer.id}</td>
                  <td>{commoditiesById.get(customer.currency_guid)?.mnemonic || customer.currency_guid}</td>
                  <td>{customer.addr_email || "-"}</td>
                  <td>{customer.addr_phone || "-"}</td>
                  <td>
                    {customer.income_account_guid
                      ? accountFullNameById.get(customer.income_account_guid) ||
                        accountsById.get(customer.income_account_guid)?.name ||
                        customer.income_account_guid
                      : "-"}
                  </td>
                  <td>{customer.active ? "Sim" : "Não"}</td>
                  <td className="small-muted">{customer.guid}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-secondary me-2"
                      type="button"
                      onClick={() => startEdit(customer)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      type="button"
                      onClick={() => remove(customer.guid)}
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
          Mostrando {pagedCustomers.length} de {totalCustomerItems} clientes
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="form-label mb-0 small-muted">Itens por página</label>
          <select
            className="form-select form-select-sm"
            value={customerPageSize}
            onChange={(event) => setCustomerPageSize(Number(event.target.value) || 25)}
            disabled={!activeBookId}
            style={{ width: "96px" }}
          >
            {CUSTOMER_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setCustomerPage(1)}
            disabled={!activeBookId || currentCustomerPage <= 1}
          >
            Primeira
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setCustomerPage((current) => Math.max(1, current - 1))}
            disabled={!activeBookId || currentCustomerPage <= 1}
          >
            Anterior
          </button>
          <span className="small-muted">
            Página {totalCustomerItems === 0 ? 0 : currentCustomerPage} de {totalCustomerItems === 0 ? 0 : totalCustomerPages}
          </span>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setCustomerPage((current) => Math.min(totalCustomerPages, current + 1))}
            disabled={!activeBookId || currentCustomerPage >= totalCustomerPages || totalCustomerItems === 0}
          >
            Próxima
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setCustomerPage(totalCustomerPages)}
            disabled={!activeBookId || currentCustomerPage >= totalCustomerPages || totalCustomerItems === 0}
          >
            Última
          </button>
        </div>
      </div>

      {customerModalOpen ? (
        <div className="modal d-block vendor-modal" tabIndex={-1} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-xl vendor-modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingGuid ? "Editar cliente" : "Novo cliente"}</h5>
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
                    <label className="form-label">Desconto Num</label>
                    <input
                      className="form-control"
                      type="number"
                      value={form.discount_num}
                      onChange={(event) => setForm({ ...form, discount_num: event.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Desconto Denom</label>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      value={form.discount_denom}
                      onChange={(event) => setForm({ ...form, discount_denom: event.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Crédito Num</label>
                    <input
                      className="form-control"
                      type="number"
                      value={form.credit_num}
                      onChange={(event) => setForm({ ...form, credit_num: event.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Crédito Denom</label>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      value={form.credit_denom}
                      onChange={(event) => setForm({ ...form, credit_denom: event.target.value })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Conta de Receita Padrão</label>
                    <div className="tree-select">
                      <button
                        type="button"
                        className="form-select tree-select-toggle"
                        onClick={toggleIncomePicker}
                      >
                        <span
                          className="tree-select-label"
                          title={
                            selectedIncomeAccount
                              ? `${selectedIncomeAccountPath} (${selectedIncomeAccount.type})`
                              : incomeAccountLabel
                          }
                        >
                          {incomeAccountLabel}
                        </span>
                        <span className="tree-select-caret">{incomePickerOpen ? "▲" : "▼"}</span>
                      </button>
                      {incomePickerOpen ? (
                        <div className="tree-select-menu">
                          <input
                            className="form-control mb-2"
                            value={incomeSearch}
                            onChange={(event) => setIncomeSearch(event.target.value)}
                            placeholder="Filtrar conta de receita"
                          />
                          <div className="counter-tree-panel">
                            {visibleIncomeTree.length > 0 ? (
                              renderIncomeTreeNodes(visibleIncomeTree)
                            ) : (
                              <div className="small-muted">Nenhuma conta de receita encontrada para o filtro.</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Nome de cobrança</label>
                    <input
                      className="form-control"
                      value={form.addr_name}
                      onChange={(event) => setForm({ ...form, addr_name: event.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Telefone de cobrança</label>
                    <input
                      className="form-control"
                      value={form.addr_phone}
                      onChange={(event) => setForm({ ...form, addr_phone: event.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">E-mail de cobrança</label>
                    <input
                      className="form-control"
                      value={form.addr_email}
                      onChange={(event) => setForm({ ...form, addr_email: event.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Nome de entrega</label>
                    <input
                      className="form-control"
                      value={form.shipaddr_name}
                      onChange={(event) => setForm({ ...form, shipaddr_name: event.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Telefone de entrega</label>
                    <input
                      className="form-control"
                      value={form.shipaddr_phone}
                      onChange={(event) => setForm({ ...form, shipaddr_phone: event.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">E-mail de entrega</label>
                    <input
                      className="form-control"
                      value={form.shipaddr_email}
                      onChange={(event) => setForm({ ...form, shipaddr_email: event.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer px-0 pb-0 mt-3">
                  <button className="btn btn-outline-secondary" type="button" onClick={cancelEdit}>
                    Cancelar
                  </button>
                  <button className="btn btn-accent" type="submit" disabled={!activeBookId}>
                    {editingGuid ? "Salvar cliente" : "Criar cliente"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
      {customerModalOpen ? <div className="modal-backdrop show" /> : null}
    </div>
  );
}
