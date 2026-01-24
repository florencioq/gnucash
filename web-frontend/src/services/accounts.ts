import api from './api'

export type AccountType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY' | 'ROOT'

export interface Account {
  id: string
  book_id: string
  parent_id: string | null
  name: string
  code: string | null
  description: string | null
  type: AccountType
  commodity_id: string
  is_placeholder: boolean
  created_at: string
  updated_at: string
}

export interface AccountNode extends Account {
  children: AccountNode[]
}

export interface AccountCreate {
  book_id: string
  name: string
  type: AccountType
  commodity_id: string
  parent_id?: string | null
  code?: string | null
  description?: string | null
  is_placeholder?: boolean
}

export interface AccountUpdate {
  name?: string
  type?: AccountType
  commodity_id?: string
  parent_id?: string | null
  code?: string | null
  description?: string | null
  is_placeholder?: boolean
}

export interface AccountFilters {
  book_id?: string
  parent_id?: string
  type?: AccountType
  commodity_id?: string
}

export const accountsService = {
  async list(filters?: AccountFilters): Promise<Account[]> {
    const response = await api.get<Account[]>('/accounts', { params: filters })
    return response.data
  },

  async get(id: string): Promise<Account> {
    const response = await api.get<Account>(`/accounts/${id}`)
    return response.data
  },

  async create(data: AccountCreate): Promise<Account> {
    const response = await api.post<Account>('/accounts', data)
    return response.data
  },

  async update(id: string, data: AccountUpdate): Promise<Account> {
    const response = await api.patch<Account>(`/accounts/${id}`, data)
    return response.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/accounts/${id}`)
  },

  async move(id: string, newParentId: string | null): Promise<Account> {
    const response = await api.post<Account>(`/accounts/${id}/move`, null, {
      params: { new_parent_id: newParentId },
    })
    return response.data
  },

  async getTree(bookId: string, depth?: number): Promise<AccountNode[]> {
    const response = await api.get<AccountNode[]>('/accounts/tree', {
      params: { book_id: bookId, depth },
    })
    return response.data
  },
}
