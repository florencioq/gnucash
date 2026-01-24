/**
 * Extrai uma mensagem de erro legível de uma exceção
 */
export function getErrorMessage(err: any): string {
  if (err.response?.data) {
    const data = err.response.data
    
    // Se for uma string, retorna diretamente
    if (typeof data === 'string') {
      return data
    }
    
    // Tenta extrair detail (padrão FastAPI)
    if (data.detail) {
      // Se detail for um array (validação do Pydantic)
      if (Array.isArray(data.detail)) {
        return data.detail.map((item: any) => {
          if (typeof item === 'string') return item
          if (item.msg) return `${item.loc?.join('.')}: ${item.msg}`
          return JSON.stringify(item)
        }).join('\n')
      }
      // Se detail for string
      if (typeof data.detail === 'string') {
        return data.detail
      }
    }
    
    // Tenta message
    if (data.message) {
      return data.message
    }
    
    // Último recurso: serializa o objeto
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return 'Erro desconhecido'
    }
  }
  
  // Se tiver message direto no erro
  if (err.message) {
    return err.message
  }
  
  return 'Erro desconhecido'
}
