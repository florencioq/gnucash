import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8001',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 segundos
})

// Interceptor para melhor tratamento de erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Melhorar mensagens de erro de conexão
    if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
      error.message = 'Não foi possível conectar ao servidor. Verifique se o backend está rodando em http://localhost:8001'
    }
    return Promise.reject(error)
  }
)

export default api
