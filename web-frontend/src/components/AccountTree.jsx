import React from "react";

function Node({ node }) {
  return (
    <div className="tree-node">
      <div className="d-flex align-items-center gap-2">
        <span className="fw-semibold">{node.name}</span>
        <span className="badge badge-soft text-uppercase">{node.type}</span>
        {node.is_placeholder ? (
          <span className="badge text-bg-secondary">placeholder</span>
        ) : null}
      </div>
      {node.children && node.children.length > 0 ? (
        <div className="mt-2">
          {node.children.map((child) => (
            <Node key={child.id} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AccountTree({ nodes }) {
  if (!nodes || nodes.length === 0) {
    return <div className="small-muted">No accounts yet.</div>;
  }

  return (
    <div>
      {nodes.map((node) => (
        <Node key={node.id} node={node} />
      ))}
    </div>
  );
}
