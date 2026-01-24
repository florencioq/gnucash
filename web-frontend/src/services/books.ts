import api from './api'

export interface Book {
  id: string
  name: string | null
  created_at: string
}

export interface BookCreate {
  name?: string | null
}

export const booksService = {
  async list(): Promise<Book[]> {
    const response = await api.get<Book[]>('/books')
    return response.data
  },

  async get(id: string): Promise<Book> {
    const response = await api.get<Book>(`/books/${id}`)
    return response.data
  },

  async create(data: BookCreate): Promise<Book> {
    const response = await api.post<Book>('/books', data)
    return response.data
  },
}
