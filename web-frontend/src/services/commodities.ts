import api from './api'

export interface Commodity {
  id: string
  namespace: string
  mnemonic: string
  fullname: string | null
  fraction: number
  quote: boolean
}

export interface CommodityCreate {
  namespace: string
  mnemonic: string
  fullname?: string | null
  fraction: number
  quote?: boolean
}

export interface CommodityFilters {
  namespace?: string
  mnemonic?: string
}

export const commoditiesService = {
  async list(filters?: CommodityFilters): Promise<Commodity[]> {
    const response = await api.get<Commodity[]>('/commodities', { params: filters })
    return response.data
  },

  async get(id: string): Promise<Commodity> {
    const response = await api.get<Commodity>(`/commodities/${id}`)
    return response.data
  },

  async create(data: CommodityCreate): Promise<Commodity> {
    const response = await api.post<Commodity>('/commodities', data)
    return response.data
  },
}
