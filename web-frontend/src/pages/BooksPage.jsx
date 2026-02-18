import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";

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

export default function BooksPage() {
  const [books, setBooks] = useState([]);
  const [name, setName] = useState("");
  const [createIsActive, setCreateIsActive] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState({});

  const [setupBookId, setSetupBookId] = useState("");
  const [setupBookName, setSetupBookName] = useState("");
  const [setupAccounts, setSetupAccounts] = useState([]);
  const [setupAccountTree, setSetupAccountTree] = useState([]);
  const [setupForm, setSetupForm] = useState({
    default_payables_account_guid: "",
    default_receivables_account_guid: "",
    default_iss_recoverable_account_guid: ""
  });

  const [payablesPickerOpen, setPayablesPickerOpen] = useState(false);
  const [payablesSearch, setPayablesSearch] = useState("");
  const [receivablesPickerOpen, setReceivablesPickerOpen] = useState(false);
  const [receivablesSearch, setReceivablesSearch] = useState("");
  const [issPickerOpen, setIssPickerOpen] = useState(false);
  const [issSearch, setIssSearch] = useState("");

  const setupAccountsById = useMemo(
    () => new Map(setupAccounts.map((account) => [account.id, account])),
    [setupAccounts]
  );

  const setupAccountFullNameById = useMemo(() => {
    const cache = new Map();

    const build = (accountId, visited = new Set()) => {
      if (cache.has(accountId)) return cache.get(accountId);
      if (visited.has(accountId)) return setupAccountsById.get(accountId)?.name || accountId;
      visited.add(accountId);

      const account = setupAccountsById.get(accountId);
      if (!account) return accountId;
      if (account.type === "ROOT" || !account.parent_id) {
        cache.set(accountId, account.name);
        return account.name;
      }

      const parent = setupAccountsById.get(account.parent_id);
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

    for (const account of setupAccounts) {
      build(account.id);
    }

    return cache;
  }, [setupAccounts, setupAccountsById]);

  const payablesTree = useMemo(
    () => keepTypeBranches(setupAccountTree, new Set(["LIABILITY"])),
    [setupAccountTree]
  );
  const receivablesTree = useMemo(
    () => keepTypeBranches(setupAccountTree, new Set(["ASSET"])),
    [setupAccountTree]
  );
  const issTree = useMemo(
    () => keepTypeBranches(setupAccountTree, new Set(["ASSET"])),
    [setupAccountTree]
  );

  const visiblePayablesTree = useMemo(
    () => filterTree(payablesTree, payablesSearch),
    [payablesTree, payablesSearch]
  );
  const visibleReceivablesTree = useMemo(
    () => filterTree(receivablesTree, receivablesSearch),
    [receivablesTree, receivablesSearch]
  );
  const visibleIssTree = useMemo(
    () => filterTree(issTree, issSearch),
    [issTree, issSearch]
  );

  const selectedPayables = setupAccountsById.get(setupForm.default_payables_account_guid) || null;
  const selectedReceivables = setupAccountsById.get(setupForm.default_receivables_account_guid) || null;
  const selectedIssRecoverable = setupAccountsById.get(setupForm.default_iss_recoverable_account_guid) || null;

  const payablesLabel = selectedPayables
    ? `${reverseAccountPath(setupAccountFullNameById.get(selectedPayables.id) || selectedPayables.name)} (${selectedPayables.type})`
    : "Selecione a conta de A/P";
  const receivablesLabel = selectedReceivables
    ? `${reverseAccountPath(setupAccountFullNameById.get(selectedReceivables.id) || selectedReceivables.name)} (${selectedReceivables.type})`
    : "Selecione a conta de A/R";
  const issLabel = selectedIssRecoverable
    ? `${reverseAccountPath(setupAccountFullNameById.get(selectedIssRecoverable.id) || selectedIssRecoverable.name)} (${selectedIssRecoverable.type})`
    : "Selecione a conta de ISS a Recuperar";

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
    if (setupBookId === bookId) {
      closeSetup();
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

  const loadSetupContext = async (bookId) => {
    const [accountsRes, treeRes] = await Promise.all([
      api.get(`/accounts?book_id=${bookId}`),
      api.get(`/accounts/tree?book_id=${bookId}`)
    ]);

    if (!accountsRes.ok) {
      setError(accountsRes.error);
      return false;
    }
    if (!treeRes.ok) {
      setError(treeRes.error);
      return false;
    }

    setError(null);
    setSetupAccounts(accountsRes.data.filter((account) => account.type !== "ROOT"));
    setSetupAccountTree(treeRes.data);
    return true;
  };

  const openSetup = async (book) => {
    setSetupBookId(book.id);
    setSetupBookName(book.name || "(sem nome)");
    setSetupForm({
      default_payables_account_guid: book.default_payables_account_guid || "",
      default_receivables_account_guid: book.default_receivables_account_guid || "",
      default_iss_recoverable_account_guid: book.default_iss_recoverable_account_guid || ""
    });
    setPayablesPickerOpen(false);
    setPayablesSearch("");
    setReceivablesPickerOpen(false);
    setReceivablesSearch("");
    setIssPickerOpen(false);
    setIssSearch("");
    await loadSetupContext(book.id);
  };

  const closeSetup = () => {
    setSetupBookId("");
    setSetupBookName("");
    setSetupAccounts([]);
    setSetupAccountTree([]);
    setSetupForm({
      default_payables_account_guid: "",
      default_receivables_account_guid: "",
      default_iss_recoverable_account_guid: ""
    });
    setPayablesPickerOpen(false);
    setPayablesSearch("");
    setReceivablesPickerOpen(false);
    setReceivablesSearch("");
    setIssPickerOpen(false);
    setIssSearch("");
  };

  const saveSetup = async () => {
    if (!setupBookId) return;
    const payload = {
      default_payables_account_guid: emptyToNull(setupForm.default_payables_account_guid),
      default_receivables_account_guid: emptyToNull(setupForm.default_receivables_account_guid),
      default_iss_recoverable_account_guid: emptyToNull(setupForm.default_iss_recoverable_account_guid)
    };
    const res = await api.patch(`/books/${setupBookId}`, payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    const updated = res.data;
    setSetupBookName(updated.name || setupBookName);
    setSetupForm({
      default_payables_account_guid: updated.default_payables_account_guid || "",
      default_receivables_account_guid: updated.default_receivables_account_guid || "",
      default_iss_recoverable_account_guid: updated.default_iss_recoverable_account_guid || ""
    });
    await load();
  };

  const togglePayablesPicker = () => {
    setPayablesPickerOpen((current) => {
      const next = !current;
      if (next) setPayablesSearch("");
      return next;
    });
  };

  const toggleReceivablesPicker = () => {
    setReceivablesPickerOpen((current) => {
      const next = !current;
      if (next) setReceivablesSearch("");
      return next;
    });
  };

  const toggleIssPicker = () => {
    setIssPickerOpen((current) => {
      const next = !current;
      if (next) setIssSearch("");
      return next;
    });
  };

  const renderSetupTreeNodes = (nodes, depth, selectedGuid, selectableType, onSelect) => {
    return nodes.map((node) => {
      if (node.type === "ROOT") {
        return (
          <div key={node.id}>
            {node.children && node.children.length > 0
              ? renderSetupTreeNodes(node.children, depth, selectedGuid, selectableType, onSelect)
              : null}
          </div>
        );
      }

      const selected = selectedGuid === node.id;
      const selectable = node.type === selectableType && !node.is_placeholder;

      return (
        <div key={node.id}>
          <button
            type="button"
            className={`counter-tree-node ${selected ? "is-selected" : ""}`}
            style={{ marginLeft: `${depth * 14}px` }}
            disabled={!selectable}
            onClick={() => {
              if (selectable) onSelect(node.id);
            }}
          >
            <span className="counter-tree-name">{node.name}</span>
            <span className="badge badge-soft text-uppercase">{node.type}</span>
            {node.is_placeholder ? <span className="small-muted">marcador</span> : null}
          </button>
          {node.children && node.children.length > 0
            ? renderSetupTreeNodes(node.children, depth + 1, selectedGuid, selectableType, onSelect)
            : null}
        </div>
      );
    });
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
                  <button
                    className="btn btn-sm btn-outline-primary me-2"
                    onClick={() => openSetup(book)}
                    type="button"
                  >
                    Setup
                  </button>
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

      {setupBookId ? (
        <div className="mt-4">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="mb-0">Setup do Livro: {setupBookName}</h5>
            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={closeSetup}>
              Fechar
            </button>
          </div>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Conta padrão de Payables (A/P)</label>
              <div className="tree-select">
                <button
                  type="button"
                  className="form-select tree-select-toggle"
                  onClick={togglePayablesPicker}
                >
                  <span className="tree-select-label">{payablesLabel}</span>
                  <span className="tree-select-caret">{payablesPickerOpen ? "▲" : "▼"}</span>
                </button>
                {payablesPickerOpen ? (
                  <div className="tree-select-menu">
                    <input
                      className="form-control mb-2"
                      value={payablesSearch}
                      onChange={(event) => setPayablesSearch(event.target.value)}
                      placeholder="Filtrar conta de A/P"
                    />
                    <div className="counter-tree-panel">
                      {visiblePayablesTree.length > 0 ? (
                        renderSetupTreeNodes(
                          visiblePayablesTree,
                          0,
                          setupForm.default_payables_account_guid,
                          "LIABILITY",
                          (accountId) => {
                            setSetupForm((current) => ({ ...current, default_payables_account_guid: accountId }));
                            setPayablesPickerOpen(false);
                            setPayablesSearch("");
                          }
                        )
                      ) : (
                        <div className="small-muted">Nenhuma conta de passivo encontrada para o filtro.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="col-md-4">
              <label className="form-label">Conta padrão de Receivables (A/R)</label>
              <div className="tree-select">
                <button
                  type="button"
                  className="form-select tree-select-toggle"
                  onClick={toggleReceivablesPicker}
                >
                  <span className="tree-select-label">{receivablesLabel}</span>
                  <span className="tree-select-caret">{receivablesPickerOpen ? "▲" : "▼"}</span>
                </button>
                {receivablesPickerOpen ? (
                  <div className="tree-select-menu">
                    <input
                      className="form-control mb-2"
                      value={receivablesSearch}
                      onChange={(event) => setReceivablesSearch(event.target.value)}
                      placeholder="Filtrar conta de A/R"
                    />
                    <div className="counter-tree-panel">
                      {visibleReceivablesTree.length > 0 ? (
                        renderSetupTreeNodes(
                          visibleReceivablesTree,
                          0,
                          setupForm.default_receivables_account_guid,
                          "ASSET",
                          (accountId) => {
                            setSetupForm((current) => ({
                              ...current,
                              default_receivables_account_guid: accountId
                            }));
                            setReceivablesPickerOpen(false);
                            setReceivablesSearch("");
                          }
                        )
                      ) : (
                        <div className="small-muted">Nenhuma conta de ativo encontrada para o filtro.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="col-md-4">
              <label className="form-label">Conta padrão de ISS a Recuperar</label>
              <div className="tree-select">
                <button
                  type="button"
                  className="form-select tree-select-toggle"
                  onClick={toggleIssPicker}
                >
                  <span className="tree-select-label">{issLabel}</span>
                  <span className="tree-select-caret">{issPickerOpen ? "▲" : "▼"}</span>
                </button>
                {issPickerOpen ? (
                  <div className="tree-select-menu">
                    <input
                      className="form-control mb-2"
                      value={issSearch}
                      onChange={(event) => setIssSearch(event.target.value)}
                      placeholder="Filtrar conta de ISS"
                    />
                    <div className="counter-tree-panel">
                      {visibleIssTree.length > 0 ? (
                        renderSetupTreeNodes(
                          visibleIssTree,
                          0,
                          setupForm.default_iss_recoverable_account_guid,
                          "ASSET",
                          (accountId) => {
                            setSetupForm((current) => ({
                              ...current,
                              default_iss_recoverable_account_guid: accountId
                            }));
                            setIssPickerOpen(false);
                            setIssSearch("");
                          }
                        )
                      ) : (
                        <div className="small-muted">Nenhuma conta de ativo encontrada para o filtro.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="col-md-12 d-flex justify-content-end">
              <button className="btn btn-accent" type="button" onClick={saveSetup}>
                Salvar setup
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
