import React, { useEffect, useMemo, useState } from "react";

function formatAmount(value, mnemonic) {
  const decimal = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

  if (typeof mnemonic === "string" && mnemonic.trim()) {
    return `${mnemonic.trim()} ${decimal}`;
  }
  return decimal;
}

function gcdBigInt(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0n ? 1n : x;
}

function normalizeRational(value) {
  let numerator = value.numerator;
  let denominator = value.denominator;
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const divisor = gcdBigInt(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor
  };
}

function addRational(left, right) {
  const l = normalizeRational(left);
  const r = normalizeRational(right);
  const divisor = gcdBigInt(l.denominator, r.denominator);
  const lcm = (l.denominator / divisor) * r.denominator;
  return normalizeRational({
    numerator:
      l.numerator * (lcm / l.denominator) +
      r.numerator * (lcm / r.denominator),
    denominator: lcm
  });
}

function toRational(balanceNum, balanceDenom) {
  const denominator = BigInt(Number(balanceDenom) || 1);
  return normalizeRational({
    numerator: BigInt(Number(balanceNum) || 0),
    denominator: denominator === 0n ? 1n : denominator
  });
}

function computeEffectiveBalances(nodes) {
  const map = new Map();

  const walk = (node) => {
    const children = Array.isArray(node.children) ? node.children : [];
    let childrenSum = { numerator: 0n, denominator: 1n };
    for (const child of children) {
      childrenSum = addRational(childrenSum, walk(child));
    }

    const own = toRational(node.balance_num, node.balance_denom);
    // Parent accounts should show hierarchical balance in the tree view.
    // Placeholder accounts keep strict children aggregation.
    const effective = node.is_placeholder
      ? childrenSum
      : addRational(own, childrenSum);
    map.set(node.id, effective);
    return effective;
  };

  for (const node of nodes || []) {
    walk(node);
  }

  return map;
}

function pruneZeroBalanceNodes(nodes, effectiveBalanceById) {
  const visit = (node) => {
    const children = Array.isArray(node.children) ? node.children : [];
    const visibleChildren = children.map(visit).filter(Boolean);
    const effective = effectiveBalanceById.get(node.id) || {
      numerator: 0n,
      denominator: 1n
    };
    const isZero = effective.numerator === 0n;

    // Keep non-zero nodes and keep zero parents that still have visible descendants.
    if (isZero && visibleChildren.length === 0) return null;

    if (visibleChildren.length === children.length) return node;
    return { ...node, children: visibleChildren };
  };

  return (nodes || []).map(visit).filter(Boolean);
}

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

function Node({
  node,
  collapsedIds,
  onToggleCollapse,
  effectiveBalanceById,
  commodityMnemonicById,
  onLedger,
  onEdit,
  onDelete
}) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isCollapsed = hasChildren && collapsedIds.has(node.id);
  const effectiveBalance = effectiveBalanceById.get(node.id) || {
    numerator: BigInt(Number(node.balance_num) || 0),
    denominator: BigInt(Number(node.balance_denom) || 1)
  };
  const balanceValue =
    Number(effectiveBalance.numerator) / Number(effectiveBalance.denominator || 1n);
  const mnemonic = commodityMnemonicById?.get(node.commodity_id);

  return (
    <div className="tree-node">
      <div className="account-tree-row">
        <div className="account-tree-main">
          {hasChildren ? (
            <button
              type="button"
              className="tree-node-toggle"
              onClick={() => onToggleCollapse(node.id)}
              title={isCollapsed ? "Expandir conta" : "Recolher conta"}
              aria-label={isCollapsed ? "Expandir conta" : "Recolher conta"}
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
            <span className="badge text-bg-secondary">marcador</span>
          ) : null}
          {node.code ? <span className="tree-node-code small-muted">Nº {node.code}</span> : null}
        </div>
        <div className="account-tree-balance-wrap">
          <span className="tree-node-balance">{formatAmount(balanceValue, mnemonic)}</span>
        </div>
        <div className="account-tree-actions d-flex gap-2">
          {onLedger && node.type !== "ROOT" ? (
            <IconButton title="Abrir razão" onClick={() => onLedger(node)}>
              <LedgerIcon />
            </IconButton>
          ) : null}
          <IconButton title="Editar conta" onClick={() => onEdit(node)}>
            <EditIcon />
          </IconButton>
          <IconButton title="Excluir conta" onClick={() => onDelete(node)}>
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
              effectiveBalanceById={effectiveBalanceById}
              commodityMnemonicById={commodityMnemonicById}
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

export default function AccountTree({
  nodes,
  hideZeroBalances = false,
  commodityMnemonicById,
  onLedger,
  onEdit,
  onDelete
}) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const effectiveBalanceById = useMemo(
    () => computeEffectiveBalances(nodes || []),
    [nodes]
  );
  const renderedNodes = useMemo(
    () => (hideZeroBalances ? pruneZeroBalanceNodes(nodes || [], effectiveBalanceById) : nodes || []),
    [nodes, hideZeroBalances, effectiveBalanceById]
  );

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
    walk(renderedNodes ?? []);

    setCollapsedIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [renderedNodes]);

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

  if (!renderedNodes || renderedNodes.length === 0) {
    return <div className="small-muted">Nenhuma conta cadastrada.</div>;
  }

  return (
    <div>
      {renderedNodes.map((node) => (
        <Node
          key={node.id}
          node={node}
          collapsedIds={collapsedIds}
          onToggleCollapse={toggleCollapse}
          effectiveBalanceById={effectiveBalanceById}
          commodityMnemonicById={commodityMnemonicById}
          onLedger={onLedger}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
