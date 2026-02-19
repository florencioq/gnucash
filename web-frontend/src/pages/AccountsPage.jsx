import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import AccountTree from "../components/AccountTree.jsx";
import useActiveBook from "../hooks/useActiveBook.js";

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

export default function AccountsPage({ onOpenLedger = () => {} }) {
  const [commodities, setCommodities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [tree, setTree] = useState([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [hideZeroBalances, setHideZeroBalances] = useState(false);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [parentSearch, setParentSearch] = useState("");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const { activeBook, activeBookId, activeBookError } = useActiveBook();
  const [form, setForm] = useState({
    name: "",
    type: "ASSET",
    commodity_id: "",
    parent_id: "",
    is_placeholder: false
  });

  const isRootType = form.type === "ROOT";
  const commodityMnemonicById = useMemo(
    () => new Map(commodities.map((commodity) => [commodity.id, commodity.mnemonic])),
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

      const parentName = build(account.parent_id, visited);
      const parent = accountsById.get(account.parent_id);
      const fullName =
        parent?.type === "ROOT"
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
  const selectedParentAccount = accountsById.get(form.parent_id) || null;
  const parentAccountLabel = isRootType
    ? "ROOT não pode ter conta pai"
    : selectedParentAccount
      ? `${accountFullNameById.get(selectedParentAccount.id) || selectedParentAccount.name} (${selectedParentAccount.type})`
      : "Selecione a conta pai";
  const visibleParentTree = useMemo(
    () => filterTree(tree, parentSearch),
    [tree, parentSearch]
  );
  const visibleAccountTree = useMemo(
    () => filterTree(tree, accountSearch),
    [tree, accountSearch]
  );

  const loadCommodities = async () => {
    const res = await api.get("/commodities?namespace=CURRENCY");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCommodities(res.data);
    if (!form.commodity_id && res.data.length > 0) {
      setForm((prev) => ({ ...prev, commodity_id: res.data[0].id }));
    }
  };

  const loadAccounts = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/accounts?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAccounts(res.data);
  };

  const loadTree = async (bookId) => {
    if (!bookId) return;
    const res = await api.get(`/accounts/tree?book_id=${bookId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTree(res.data);
  };

  const loadAll = async (bookId) => {
    await Promise.all([loadAccounts(bookId), loadTree(bookId)]);
  };

  useEffect(() => {
    loadCommodities();
  }, []);

  useEffect(() => {
    if (activeBookId) {
      loadAll(activeBookId);
      return;
    }
    setAccountModalOpen(false);
    setEditing(null);
    setAccountSearch("");
  }, [activeBookId]);

  useEffect(() => {
    setParentPickerOpen(false);
    setParentSearch("");
    setForm((current) => {
      if (!current.parent_id) return current;
      if (accounts.some((account) => account.id === current.parent_id)) return current;
      return { ...current, parent_id: "" };
    });
  }, [accounts]);

  useEffect(() => {
    if (!isRootType) return;
    setParentPickerOpen(false);
    setParentSearch("");
  }, [isRootType]);

  const create = async (event) => {
    event.preventDefault();
    if (!activeBookId) return;
    const payload = {
      book_id: activeBookId,
      name: form.name,
      type: form.type,
      commodity_id: form.commodity_id,
      is_placeholder: form.is_placeholder
    };
    if (!isRootType && form.parent_id) {
      payload.parent_id = form.parent_id;
    }
    const res = await api.post("/accounts", payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setForm({
      name: "",
      type: "ASSET",
      commodity_id: form.commodity_id,
      parent_id: "",
      is_placeholder: false
    });
    setAccountModalOpen(false);
    await loadAll(activeBookId);
  };

  const remove = async (accountId) => {
    const res = await api.del(`/accounts/${accountId}`);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await loadAll(activeBookId);
  };

  const editAccount = async (account) => {
    setEditing({
      id: account.id,
      name: account.name,
      type: account.type,
      is_placeholder: account.is_placeholder
    });
    setError(null);
    setAccountModalOpen(true);
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!editing) return;
    const trimmed = editing.name.trim();
    if (!trimmed) {
      setError({ code: "VALIDATION_ERROR", message: "nome não pode ser vazio", details: {} });
      return;
    }
    const isPlaceholder = editing.type === "ROOT" ? true : editing.is_placeholder;
    const res = await api.patch(`/accounts/${editing.id}`, {
      name: trimmed,
      is_placeholder: isPlaceholder
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(null);
    setAccountModalOpen(false);
    await loadAll(activeBookId);
  };

  const openCreateAccountModal = () => {
    setEditing(null);
    setForm((current) => ({
      ...current,
      name: "",
      type: "ASSET",
      parent_id: "",
      is_placeholder: false
    }));
    setParentPickerOpen(false);
    setParentSearch("");
    setError(null);
    setAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    setAccountModalOpen(false);
    setParentPickerOpen(false);
    setParentSearch("");
    setEditing(null);
  };

  const openLedgerFromTree = (node) => {
    if (!activeBookId || !node?.id || node.type === "ROOT") return;
    onOpenLedger({ accountId: node.id });
  };

  const selectParentAccount = (accountId) => {
    const parentAccount = accountsById.get(accountId);
    setForm((current) => {
      const nextType =
        parentAccount && parentAccount.type !== "ROOT"
          ? parentAccount.type
          : current.type;
      return {
        ...current,
        parent_id: accountId,
        type: nextType
      };
    });
    setParentSearch("");
    setParentPickerOpen(false);
  };

  const toggleParentPicker = () => {
    if (isRootType) return;
    setParentPickerOpen((current) => {
      const next = !current;
      if (next) setParentSearch("");
      return next;
    });
  };

  const renderParentTreeNodes = (nodes, depth = 0) => {
    return nodes.map((node) => {
      if (node.type === "ROOT") {
        return (
          <div key={node.id}>
            {node.children && node.children.length > 0
              ? renderParentTreeNodes(node.children, depth)
              : null}
          </div>
        );
      }

      const selected = form.parent_id === node.id;

      return (
        <div key={node.id}>
          <button
            type="button"
            className={`counter-tree-node ${selected ? "is-selected" : ""}`}
            style={{ marginLeft: `${depth * 14}px` }}
            onClick={() => selectParentAccount(node.id)}
          >
            <span className="counter-tree-name">{node.name}</span>
            <span className="badge badge-soft text-uppercase">{node.type}</span>
          </button>
          {node.children && node.children.length > 0
            ? renderParentTreeNodes(node.children, depth + 1)
            : null}
        </div>
      );
    });
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Contas</h2>
          <div className="small-muted">Gerencie a hierarquia de contas por livro.</div>
        </div>
        <button className="btn btn-accent" type="button" onClick={openCreateAccountModal} disabled={!activeBookId}>
          Nova conta
        </button>
      </div>

      {activeBook ? (
        <div className="small-muted mb-4">Livro ativo: {activeBook.name || activeBook.id}</div>
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

      <div className="section-card accounts-tree-shell">
        <h5 className="mb-3">Árvore de contas</h5>
        <div className="row g-2 align-items-end mb-3">
          <div className="col-md-5">
            <label className="form-label">Buscar por nome</label>
            <input
              className="form-control"
              value={accountSearch}
              onChange={(event) => setAccountSearch(event.target.value)}
              placeholder="Digite o nome da conta"
              disabled={!activeBookId}
            />
          </div>
          <div className="col-md-4">
            <div className="form-check mt-4">
              <input
                id="accounts-hide-zero-balances"
                className="form-check-input"
                type="checkbox"
                checked={hideZeroBalances}
                onChange={(event) => setHideZeroBalances(event.target.checked)}
                disabled={!activeBookId}
              />
              <label className="form-check-label" htmlFor="accounts-hide-zero-balances">
                Ocultar contas com saldo zerado
              </label>
            </div>
          </div>
        </div>
        <AccountTree
          nodes={visibleAccountTree}
          hideZeroBalances={hideZeroBalances}
          commodityMnemonicById={commodityMnemonicById}
          onLedger={openLedgerFromTree}
          onEdit={(node) => editAccount(node)}
          onDelete={(node) => remove(node.id)}
        />
      </div>

      {accountModalOpen ? (
        <div className="modal d-block vendor-modal" tabIndex={-1} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-xl vendor-modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editing ? "Editar conta" : "Nova conta"}</h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={closeAccountModal} />
              </div>
              {editing ? (
                <form className="modal-body" onSubmit={submitEdit}>
                  <div className="row g-2 align-items-end">
                    <div className="col-md-5">
                      <label className="form-label">Editar nome</label>
                      <input
                        className="form-control"
                        value={editing.name}
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Marcador</label>
                      <select
                        className="form-select"
                        value={editing.type === "ROOT" ? "true" : editing.is_placeholder ? "true" : "false"}
                        onChange={(event) =>
                          setEditing({ ...editing, is_placeholder: event.target.value === "true" })
                        }
                        disabled={editing.type === "ROOT"}
                      >
                        <option value="false">Não</option>
                        <option value="true">Sim</option>
                      </select>
                      {editing.type === "ROOT" ? (
                        <div className="small-muted mt-1">ROOT deve ser marcador.</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="modal-footer px-0 pb-0 mt-3">
                    <button className="btn btn-outline-secondary" type="button" onClick={closeAccountModal}>
                      Cancelar
                    </button>
                    <button className="btn btn-accent" type="submit">
                      Salvar alterações
                    </button>
                  </div>
                </form>
              ) : (
                <form className="modal-body" onSubmit={create}>
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
                      <label className="form-label">Tipo</label>
                      <select
                        className="form-select"
                        value={form.type}
                        onChange={(event) => {
                          const nextType = event.target.value;
                          setForm({
                            ...form,
                            type: nextType,
                            parent_id: nextType === "ROOT" ? "" : form.parent_id,
                            is_placeholder: nextType === "ROOT" ? true : form.is_placeholder
                          });
                        }}
                      >
                        {[
                          "ROOT",
                          "ASSET",
                          "LIABILITY",
                          "INCOME",
                          "EXPENSE",
                          "EQUITY"
                        ].map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Moeda</label>
                      <select
                        className="form-select"
                        value={form.commodity_id}
                        onChange={(event) => setForm({ ...form, commodity_id: event.target.value })}
                      >
                        {commodities.map((commodity) => (
                          <option key={commodity.id} value={commodity.id}>
                            {commodity.mnemonic}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Conta pai</label>
                      <div className="tree-select">
                        <button
                          type="button"
                          className="form-select tree-select-toggle"
                          onClick={toggleParentPicker}
                          disabled={isRootType}
                        >
                          <span className="tree-select-label">{parentAccountLabel}</span>
                          <span className="tree-select-caret">{parentPickerOpen ? "▲" : "▼"}</span>
                        </button>
                        {parentPickerOpen ? (
                          <div className="tree-select-menu">
                            <input
                              className="form-control mb-2"
                              value={parentSearch}
                              onChange={(event) => setParentSearch(event.target.value)}
                              placeholder="Filtrar conta pai"
                            />
                            <div className="counter-tree-panel">
                              {visibleParentTree.length > 0 ? (
                                renderParentTreeNodes(visibleParentTree)
                              ) : (
                                <div className="small-muted">Nenhuma conta encontrada para este filtro.</div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      {isRootType ? (
                        <div className="small-muted mt-1">ROOT não pode ter conta pai.</div>
                      ) : null}
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Marcador</label>
                      <select
                        className="form-select"
                        value={form.is_placeholder ? "true" : "false"}
                        onChange={(event) =>
                          setForm({ ...form, is_placeholder: event.target.value === "true" })
                        }
                      >
                        <option value="false">Não</option>
                        <option value="true">Sim</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer px-0 pb-0 mt-3">
                    <button className="btn btn-outline-secondary" type="button" onClick={closeAccountModal}>
                      Cancelar
                    </button>
                    <button className="btn btn-accent" type="submit" disabled={!activeBookId}>
                      Criar conta
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {accountModalOpen ? <div className="modal-backdrop show" /> : null}
    </div>
  );
}
