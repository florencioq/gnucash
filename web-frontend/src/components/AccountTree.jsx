import React from "react";

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

function Node({ node, onEdit, onDelete }) {
  return (
    <div className="tree-node">
      <div className="d-flex align-items-center gap-2">
        <span className="fw-semibold">{node.name}</span>
        <span className="badge badge-soft text-uppercase">{node.type}</span>
        {node.is_placeholder ? (
          <span className="badge text-bg-secondary">placeholder</span>
        ) : null}
        <div className="ms-auto d-flex gap-2">
          <IconButton title="Edit account" onClick={() => onEdit(node)}>
            <EditIcon />
          </IconButton>
          <IconButton title="Delete account" onClick={() => onDelete(node)}>
            <DeleteIcon />
          </IconButton>
        </div>
      </div>
      {node.children && node.children.length > 0 ? (
        <div className="mt-2">
          {node.children.map((child) => (
            <Node key={child.id} node={child} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AccountTree({ nodes, onEdit, onDelete }) {
  if (!nodes || nodes.length === 0) {
    return <div className="small-muted">No accounts yet.</div>;
  }

  return (
    <div>
      {nodes.map((node) => (
        <Node key={node.id} node={node} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
