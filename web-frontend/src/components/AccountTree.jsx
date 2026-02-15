import React, { useEffect, useState } from "react";

function IconButton({ title, onClick, children }) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{ width: "30px", height: "30px" }}
    >
      {children}
    </button>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M12.854 1.146a.5.5 0 0 0-.708 0L10.5 2.793l2.707 2.707 1.647-1.647a.5.5 0 0 0 0-.708z" />
      <path d="M10.5 3.5 3 11v2.5h2.5L13 6l-2.5-2.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5z" />
      <path d="M8 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5z" />
      <path d="M10.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5z" />
      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2h4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1H15v1zM4 4v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4H4z" />
    </svg>
  );
}

function LedgerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h8A1.5 1.5 0 0 1 13 2.5V14l-2-1-2 1-2-1-2 1V2.5zM3.5 2a.5.5 0 0 0-.5.5v9.882l1-.5 2 1 2-1 2 1 2-1 1 .5V2.5a.5.5 0 0 0-.5-.5h-8z" />
      <path d="M5 4h6v1H5zM5 6h6v1H5zM5 8h4v1H5z" />
    </svg>
  );
}

function Node({ node, collapsedIds, onToggleCollapse, onLedger, onEdit, onDelete }) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isCollapsed = hasChildren && collapsedIds.has(node.id);

  return (
    <div className="tree-node">
      <div className="d-flex align-items-center gap-2">
        {hasChildren ? (
          <button
            type="button"
            className="tree-node-toggle"
            onClick={() => onToggleCollapse(node.id)}
            title={isCollapsed ? "Expand account" : "Collapse account"}
            aria-label={isCollapsed ? "Expand account" : "Collapse account"}
            aria-expanded={!isCollapsed}
          >
            <span className={`tree-node-caret ${isCollapsed ? "is-collapsed" : ""}`} aria-hidden="true">
              ▾
            </span>
          </button>
        ) : (
          <span className="tree-node-toggle-spacer" aria-hidden="true" />
        )}
        <span className="fw-semibold">{node.name}</span>
        <span className="badge badge-soft text-uppercase">{node.type}</span>
        {node.is_placeholder ? (
          <span className="badge text-bg-secondary">placeholder</span>
        ) : null}
        <div className="ms-auto d-flex gap-2">
          {onLedger && node.type !== "ROOT" ? (
            <IconButton title="Open ledger" onClick={() => onLedger(node)}>
              <LedgerIcon />
            </IconButton>
          ) : null}
          <IconButton title="Edit account" onClick={() => onEdit(node)}>
            <EditIcon />
          </IconButton>
          <IconButton title="Delete account" onClick={() => onDelete(node)}>
            <DeleteIcon />
          </IconButton>
        </div>
      </div>
      {hasChildren && !isCollapsed ? (
        <div className="mt-2">
          {node.children.map((child) => (
            <Node
              key={child.id}
              node={child}
              collapsedIds={collapsedIds}
              onToggleCollapse={onToggleCollapse}
              onLedger={onLedger}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AccountTree({ nodes, onLedger, onEdit, onDelete }) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());

  useEffect(() => {
    const validIds = new Set();
    const walk = (items) => {
      items.forEach((item) => {
        validIds.add(item.id);
        if (item.children && item.children.length > 0) {
          walk(item.children);
        }
      });
    };
    walk(nodes ?? []);

    setCollapsedIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [nodes]);

  const toggleCollapse = (accountId) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  if (!nodes || nodes.length === 0) {
    return <div className="small-muted">No accounts yet.</div>;
  }

  return (
    <div>
      {nodes.map((node) => (
        <Node
          key={node.id}
          node={node}
          collapsedIds={collapsedIds}
          onToggleCollapse={toggleCollapse}
          onLedger={onLedger}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
