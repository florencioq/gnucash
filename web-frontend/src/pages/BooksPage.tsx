import { useState, useEffect } from 'react'
import { booksService, Book, BookCreate } from '../services/books'
import BookModal from '../components/BookModal'
import { getErrorMessage } from '../utils/errorHandler'

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)

  useEffect(() => {
    loadBooks()
  }, [])

  const loadBooks = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await booksService.list()
      setBooks(data)
    } catch (err: any) {
      const errorMessage = getErrorMessage(err)
      console.error('Erro ao carregar livros:', err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedBook(null)
    setIsModalOpen(true)
  }

  const handleEdit = (book: Book) => {
    setSelectedBook(book)
    setIsModalOpen(true)
  }

  const handleSave = async (data: BookCreate) => {
    try {
      if (selectedBook) {
        // TODO: Implementar update quando backend tiver PATCH
        alert('Atualização ainda não implementada no backend')
      } else {
        await booksService.create(data)
        await loadBooks()
        setIsModalOpen(false)
      }
    } catch (err: any) {
      const errorMessage = getErrorMessage(err)
      console.error('Erro ao salvar livro:', err)
      alert(`Erro ao salvar livro:\n\n${errorMessage}`)
    }
  }

  if (loading) {
    return <div className="loading">Carregando livros...</div>
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Livros</h2>
          <button className="btn btn-primary" onClick={handleCreate}>
            + Novo Livro
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {books.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <p>Nenhum livro cadastrado</p>
            <button className="btn btn-primary" onClick={handleCreate} style={{ marginTop: '1rem' }}>
              Criar primeiro livro
            </button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.id}>
                  <td>{book.id.substring(0, 8)}...</td>
                  <td>{book.name || '(sem nome)'}</td>
                  <td>{new Date(book.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(book)}
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <BookModal
          book={selectedBook}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
