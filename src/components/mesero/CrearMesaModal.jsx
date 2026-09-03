import { useState } from 'react'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'

// Los meseros se eligen en plural: una mesa puede repartirse entre varios desde que
// se crea (ver src/lib/asignaciones.js). Dejarla sin nadie también es válido — el
// primero que le mande una orden queda atendiéndola.
export function CrearMesaModal({ meseros, onConfirm, onClose }) {
  const [numero, setNumero] = useState('')
  const [meseroIds, setMeseroIds] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  function toggleMesero(id) {
    setMeseroIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleConfirm() {
    if (!numero.trim()) return
    setEnviando(true)
    setError(null)
    const { error } = await onConfirm(numero.trim(), meseroIds)
    if (error) {
      setError(error)
      setEnviando(false)
      return
    }
    onClose()
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
      }}
    >
      <div
        className="jb-pop"
        style={{
          background: '#fff', borderRadius: 26, width: 420, maxWidth: '100%',
          padding: 28, display: 'flex', flexDirection: 'column', gap: 18,
          fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
        }}
      >
        <div className="flex items-center justify-between">
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>Agregar mesa</h2>
          <button
            onClick={onClose}
            style={{ background: 'var(--jb-pink-light)', border: 'none', borderRadius: 12, width: 36, height: 36, fontSize: 16, fontWeight: 800, color: 'var(--jb-pink-dark)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)', margin: '0 0 8px' }}>Número de mesa</p>
          <input
            autoFocus
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ej. 16"
            style={{
              width: '100%', border: '2.5px solid var(--jb-line)', borderRadius: 14, padding: '14px 16px',
              fontFamily: "'Inter Tight', sans-serif", fontSize: 16, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)', margin: '0 0 8px' }}>
            ¿Quién la atiende? (opcional, pueden ser varios)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {meseros.map((m) => (
              <Chip key={m.id} active={meseroIds.includes(m.id)} onClick={() => toggleMesero(m.id)}>
                {m.nombre}
              </Chip>
            ))}
          </div>
          {meseroIds.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--jb-gray)', margin: '8px 0 0' }}>
              Sin asignar: quedará a nombre del primero que le mande una orden.
            </p>
          )}
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#A83232' }}>{error}</p>
        )}

        <Button onClick={handleConfirm} disabled={!numero.trim() || enviando} style={{ width: '100%' }}>
          {enviando ? 'Creando…' : 'Crear mesa'}
        </Button>
      </div>
    </div>
  )
}
