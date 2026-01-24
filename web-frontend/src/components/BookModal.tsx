import { useState, useEffect } from 'react'
import { Book, BookCreate } from '../services/books'

interface BookModalProps {
  book: Book | null
  onClose: () => void
  onSave: (data: BookCreate) => void
}

export default function BookModal({ book, onClose, onSave }: BookModalProps) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (book) {
      setName(book.name || '')
    } else {
      setName('')
    }
  }, [book])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ name: name || null })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{book ? 'Editar Livro' : 'Novo Livro'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nome</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do livro (opcional)"
            />
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
