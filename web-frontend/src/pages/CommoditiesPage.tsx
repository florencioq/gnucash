import { useState, useEffect } from 'react'
import { commoditiesService, Commodity, CommodityCreate } from '../services/commodities'
import CommodityModal from '../components/CommodityModal'

export default function CommoditiesPage() {
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCommodity, setSelectedCommodity] = useState<Commodity | null>(null)
  const [namespaceFilter, setNamespaceFilter] = useState<string>('')

  useEffect(() => {
    loadCommodities()
  }, [namespaceFilter])

  const loadCommodities = async () => {
    try {
      setLoading(true)
      setError(null)
      const filters = namespaceFilter ? { namespace: namespaceFilter } : undefined
      const data = await commoditiesService.list(filters)
      setCommodities(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar commodities')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedCommodity(null)
    setIsModalOpen(true)
  }

  const handleEdit = (commodity: Commodity) => {
    setSelectedCommodity(commodity)
    setIsModalOpen(true)
  }

  const handleSave = async (data: CommodityCreate) => {
    try {
      if (selectedCommodity) {
        // TODO: Implementar update quando backend tiver PATCH
        alert('Atualização ainda não implementada no backend')
      } else {
        await commoditiesService.create(data)
        await loadCommodities()
        setIsModalOpen(false)
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao salvar commodity')
    }
  }

  if (loading) {
    return <div className="loading">Carregando commodities...</div>
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Commodities</h2>
          <button className="btn btn-primary" onClick={handleCreate}>
            + Nova Commodity
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div style={{ marginBottom: '1rem' }}>
          <label className="form-label">Filtrar por Namespace:</label>
          <select
            className="form-select"
            value={namespaceFilter}
            onChange={(e) => setNamespaceFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="">Todos</option>
            <option value="CURRENCY">CURRENCY</option>
            <option value="FUND">FUND</option>
            <option value="STOCK">STOCK</option>
          </select>
        </div>

        {commodities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💱</div>
            <p>Nenhuma commodity cadastrada</p>
            <button className="btn btn-primary" onClick={handleCreate} style={{ marginTop: '1rem' }}>
              Criar primeira commodity
            </button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Namespace</th>
                <th>Mnemonic</th>
                <th>Nome Completo</th>
                <th>Fraction</th>
                <th>Quote</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {commodities.map((commodity) => (
                <tr key={commodity.id}>
                  <td>{commodity.namespace}</td>
                  <td><strong>{commodity.mnemonic}</strong></td>
                  <td>{commodity.fullname || '-'}</td>
                  <td>{commodity.fraction}</td>
                  <td>{commodity.quote ? '✓' : '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(commodity)}
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
        <CommodityModal
          commodity={selectedCommodity}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
