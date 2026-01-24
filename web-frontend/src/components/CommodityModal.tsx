import { useState, useEffect } from 'react'
import { Commodity, CommodityCreate } from '../services/commodities'

interface CommodityModalProps {
  commodity: Commodity | null
  onClose: () => void
  onSave: (data: CommodityCreate) => void
}

export default function CommodityModal({ commodity, onClose, onSave }: CommodityModalProps) {
  const [namespace, setNamespace] = useState('CURRENCY')
  const [mnemonic, setMnemonic] = useState('')
  const [fullname, setFullname] = useState('')
  const [fraction, setFraction] = useState('100')
  const [quote, setQuote] = useState(false)

  useEffect(() => {
    if (commodity) {
      setNamespace(commodity.namespace)
      setMnemonic(commodity.mnemonic)
      setFullname(commodity.fullname || '')
      setFraction(commodity.fraction.toString())
      setQuote(commodity.quote)
    } else {
      setNamespace('CURRENCY')
      setMnemonic('')
      setFullname('')
      setFraction('100')
      setQuote(false)
    }
  }, [commodity])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      namespace,
      mnemonic: mnemonic.toUpperCase(),
      fullname: fullname || null,
      fraction: parseInt(fraction),
      quote,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{commodity ? 'Editar Commodity' : 'Nova Commodity'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Namespace *</label>
            <select
              className="form-select"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              required
            >
              <option value="CURRENCY">CURRENCY</option>
              <option value="FUND">FUND</option>
              <option value="STOCK">STOCK</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Mnemonic *</label>
            <input
              type="text"
              className="form-input"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value.toUpperCase())}
              placeholder="USD, EUR, etc."
              required
              maxLength={16}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nome Completo</label>
            <input
              type="text"
              className="form-input"
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
              placeholder="US Dollar, Euro, etc."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fraction *</label>
            <input
              type="number"
              className="form-input"
              value={fraction}
              onChange={(e) => setFraction(e.target.value)}
              placeholder="100"
              required
              min="1"
            />
            <small style={{ color: '#666', fontSize: '0.75rem' }}>
              Menor unidade (ex: 100 para centavos)
            </small>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                className="form-checkbox"
                checked={quote}
                onChange={(e) => setQuote(e.target.checked)}
              />
              Tem cotação
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
