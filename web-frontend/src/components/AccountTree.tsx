import { useState } from 'react'
import { AccountNode } from '../services/accounts'

interface AccountTreeProps {
  tree: AccountNode[]
  onEdit: (account: AccountNode) => void
  onDelete: (id: string) => void
  loading: boolean
}

export default function AccountTree({ tree, onEdit, onDelete, loading }: AccountTreeProps) {
  if (loading) {
    return <div className="loading">Carregando árvore de contas...</div>
  }

  if (tree.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <p>Nenhuma conta cadastrada</p>
      </div>
    )
  }

  return (
    <div>
      <ul className="tree">
        {tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            onEdit={onEdit}
            onDelete={onDelete}
            level={0}
          />
        ))}
      </ul>
    </div>
  )
}

interface TreeNodeProps {
  node: AccountNode
  onEdit: (account: AccountNode) => void
  onDelete: (id: string) => void
  level: number
}

function TreeNode({ node, onEdit, onDelete, level }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2) // Expandir primeiros 2 níveis por padrão

  const hasChildren = node.children && node.children.length > 0

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ROOT: '#333333',
      ASSET: '#28a745',
      LIABILITY: '#dc3545',
      INCOME: '#17a2b8',
      EXPENSE: '#ffc107',
      EQUITY: '#6f42c1',
    }
    return colors[type] || '#666'
  }

  return (
    <li className="tree-item">
      <div className="tree-content" style={{ paddingLeft: `${level * 1.5}rem` }}>
        {hasChildren && (
          <span
            className="tree-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span className="tree-toggle" style={{ color: 'transparent' }}>•</span>}
        <span
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            minWidth: 0, // Permite que o texto seja cortado se necessário
          }}
        >
          {node.code && (
            <span style={{ 
              color: '#666', 
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              fontWeight: 500,
              flexShrink: 0,
            }}>
              {node.code}
            </span>
          )}
          <strong style={{ 
            fontSize: '1rem',
            color: '#333',
            fontWeight: 600,
            flex: '1 1 auto',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {node.name || '(sem nome)'}
          </strong>
          <span
            style={{
              fontSize: '0.75rem',
              color: getTypeColor(node.type),
              fontWeight: 600,
              padding: '0.125rem 0.375rem',
              borderRadius: '3px',
              backgroundColor: getTypeColor(node.type) + '15',
              flexShrink: 0,
            }}
          >
            {node.type}
          </span>
          {node.is_placeholder && (
            <span style={{ 
              fontSize: '0.75rem', 
              color: '#999',
              fontStyle: 'italic',
              flexShrink: 0,
            }}>
              (placeholder)
            </span>
          )}
        </span>
        <div className="table-actions" style={{ flexShrink: 0 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onEdit(node)}
          >
            Editar
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onDelete(node.id)}
          >
            Deletar
          </button>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <ul className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onEdit={onEdit}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
