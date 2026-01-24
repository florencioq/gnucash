import { useState, useEffect } from 'react'
import { accountsService, Account, AccountCreate, AccountNode } from '../services/accounts'
import { booksService, Book } from '../services/books'
import { commoditiesService, Commodity } from '../services/commodities'
import AccountModal from '../components/AccountModal'
import AccountTree from '../components/AccountTree'
import { getErrorMessage } from '../utils/errorHandler'

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [tree, setTree] = useState<AccountNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('tree')
  const [selectedBookId, setSelectedBookId] = useState<string>('')

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedBookId) {
      loadAccounts()
    }
  }, [selectedBookId, viewMode])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [booksData, commoditiesData] = await Promise.all([
        booksService.list(),
        commoditiesService.list(),
      ])
      setBooks(booksData)
      setCommodities(commoditiesData)
      if (booksData.length > 0) {
        setSelectedBookId(booksData[0].id)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async () => {
    if (!selectedBookId) return

    try {
      setLoading(true)
      setError(null)
      // Sempre carregar a lista de contas para o modal
      const accountsData = await accountsService.list({ book_id: selectedBookId })
      setAccounts(accountsData)
      
      // Se estiver no modo tree, também carregar a árvore
      if (viewMode === 'tree') {
        const treeData = await accountsService.getTree(selectedBookId)
        setTree(treeData)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar contas')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    if (!selectedBookId) {
      alert('Selecione um livro primeiro')
      return
    }
    setSelectedAccount(null)
    setIsModalOpen(true)
  }

  const handleEdit = (account: Account) => {
    setSelectedAccount(account)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta conta?')) return

    try {
      await accountsService.delete(id)
      await loadAccounts()
    } catch (err: any) {
      const errorMessage = getErrorMessage(err)
      alert(errorMessage)
    }
  }

  const handleSave = async (data: AccountCreate) => {
    try {
      if (selectedAccount) {
        const { book_id, ...updateData } = data
        await accountsService.update(selectedAccount.id, updateData)
      } else {
        await accountsService.create({ ...data, book_id: selectedBookId })
      }
      // Recarregar dados após salvar
      await loadAccounts()
      setIsModalOpen(false)
    } catch (err: any) {
      const errorMessage = getErrorMessage(err)
      alert(errorMessage)
    }
  }

  if (loading && books.length === 0) {
    return <div className="loading">Carregando...</div>
  }

  if (books.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <p>Nenhum livro cadastrado. Crie um livro primeiro.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Contas</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select
              className="form-select"
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              style={{ width: '200px' }}
            >
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name || `Livro ${book.id.substring(0, 8)}`}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('list')}
              >
                Lista
              </button>
              <button
                className={`btn ${viewMode === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('tree')}
              >
                Árvore
              </button>
            </div>
            <button className="btn btn-primary" onClick={handleCreate}>
              + Nova Conta
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {viewMode === 'tree' ? (
          <AccountTree
            tree={tree}
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={loading}
          />
        ) : (
          <>
            {accounts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p>Nenhuma conta cadastrada neste livro</p>
                <button className="btn btn-primary" onClick={handleCreate} style={{ marginTop: '1rem' }}>
                  Criar primeira conta
                </button>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Commodity</th>
                    <th>Placeholder</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.code || '-'}</td>
                      <td>{account.name}</td>
                      <td>{account.type}</td>
                      <td>{account.commodity_id.substring(0, 8)}...</td>
                      <td>{account.is_placeholder ? '✓' : '-'}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEdit(account)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(account.id)}
                          >
                            Deletar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {isModalOpen && (
        <AccountModal
          account={selectedAccount}
          books={books}
          commodities={commodities}
          accounts={accounts}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
