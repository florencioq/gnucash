import { useState, useEffect } from 'react'
import { Account, AccountCreate, AccountType } from '../services/accounts'
import { Book } from '../services/books'
import { Commodity } from '../services/commodities'

interface AccountModalProps {
  account: Account | null
  books: Book[]
  commodities: Commodity[]
  accounts: Account[]
  onClose: () => void
  onSave: (data: AccountCreate) => void
}

export default function AccountModal({
  account,
  books,
  commodities,
  accounts,
  onClose,
  onSave,
}: AccountModalProps) {
  const [bookId, setBookId] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<AccountType>('ASSET')
  const [commodityId, setCommodityId] = useState('')
  const [isPlaceholder, setIsPlaceholder] = useState(false)

  useEffect(() => {
    if (account) {
      setBookId(account.book_id)
      setParentId(account.parent_id)
      setName(account.name)
      setCode(account.code || '')
      setDescription(account.description || '')
      setType(account.type)
      setCommodityId(account.commodity_id)
      setIsPlaceholder(account.is_placeholder)
    } else {
      if (books.length > 0) {
        setBookId(books[0].id)
      }
      if (commodities.length > 0) {
        setCommodityId(commodities[0].id)
      }
      setParentId(null)
      setName('')
      setCode('')
      setDescription('')
      setType('ASSET')
      setIsPlaceholder(false)
    }
  }, [account, books, commodities])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      book_id: bookId,
      parent_id: parentId || undefined,
      name,
      code: code || undefined,
      description: description || undefined,
      type,
      commodity_id: commodityId,
      is_placeholder: isPlaceholder,
    })
  }

  // Filtrar contas disponíveis como pais:
  // 1. Do mesmo livro selecionado
  // 2. Não pode ser a própria conta (se editando)
  // 3. Ordenar por código se tiver, senão por nome
  const availableParents = accounts
    .filter((acc) => {
      // Mesmo livro
      if (acc.book_id !== bookId) return false
      // Não pode ser a própria conta
      if (account && acc.id === account.id) return false
      return true
    })
    .sort((a, b) => {
      // Ordenar por código se tiver, senão por nome
      if (a.code && b.code) {
        return a.code.localeCompare(b.code, undefined, { numeric: true })
      }
      if (a.code) return -1
      if (b.code) return 1
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3 className="modal-title">{account ? 'Editar Conta' : 'Nova Conta'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Livro *</label>
            <select
              className="form-select"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              required
              disabled={!!account}
            >
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name || `Livro ${book.id.substring(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Conta Pai</label>
            <select
              className="form-select"
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
            >
              <option value="">(Raiz - sem pai)</option>
              {availableParents.length === 0 ? (
                <option disabled>Nenhuma conta disponível neste livro</option>
              ) : (
                availableParents.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code ? `${acc.code} - ` : ''}{acc.name} ({acc.type})
                  </option>
                ))
              )}
            </select>
            {availableParents.length > 0 && (
              <small style={{ color: '#666', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
                {availableParents.length} conta{availableParents.length !== 1 ? 's' : ''} disponível{availableParents.length !== 1 ? 'is' : ''}
              </small>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da conta"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Código</label>
            <input
              type="text"
              className="form-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="100, 200, etc."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição da conta"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tipo *</label>
            <select
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              required
            >
              <option value="ROOT">ROOT</option>
              <option value="ASSET">ASSET</option>
              <option value="LIABILITY">LIABILITY</option>
              <option value="INCOME">INCOME</option>
              <option value="EXPENSE">EXPENSE</option>
              <option value="EQUITY">EQUITY</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Commodity *</label>
            <select
              className="form-select"
              value={commodityId}
              onChange={(e) => setCommodityId(e.target.value)}
              required
            >
              {commodities.map((commodity) => (
                <option key={commodity.id} value={commodity.id}>
                  {commodity.namespace}/{commodity.mnemonic} - {commodity.fullname || commodity.mnemonic}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                className="form-checkbox"
                checked={isPlaceholder}
                onChange={(e) => setIsPlaceholder(e.target.checked)}
              />
              É placeholder (conta container)
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
