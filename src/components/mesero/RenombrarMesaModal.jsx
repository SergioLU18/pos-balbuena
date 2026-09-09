import { useState } from 'react'
import { Button } from '../ui/Button'

/** Cambia el nombre de una mesa (acepta letras y números). La validación real
 *  —único, sin prefijo "PL-", longitud— la hace `onConfirm` (useMesaAdmin) y su
 *  mensaje de error se muestra aquí. */
export function RenombrarMesaModal({ mesa, onConfirm, onClose }) {
  const [nombre, setNombre] = useState(mesa.numero ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const sinCambio = nombre.trim() === (mesa.numero ?? '')

  async function handleConfirm() {
    if (!nombre.trim() || sinCambio) return
    setEnviando(true)
    setError(null)
    const { error } = await onConfirm(nombre.trim())
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
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>Cambiar nombre</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'var(--jb-pink-light)', border: 'none', borderRadius: 12, width: 36, height: 36, fontSize: 16, fontWeight: 800, color: 'var(--jb-pink-dark)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)', margin: '0 0 8px' }}>Nombre de la mesa</p>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
            maxLength={24}
            placeholder="Ej. 16 o Terraza 1"
            style={{
              width: '100%', border: '2.5px solid var(--jb-line)', borderRadius: 14, padding: '14px 16px',
              fontFamily: "'Inter Tight', sans-serif", fontSize: 16, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#A83232' }}>{error}</p>
        )}

        <Button onClick={handleConfirm} disabled={!nombre.trim() || sinCambio || enviando} style={{ width: '100%' }}>
          {enviando ? 'Guardando…' : 'Guardar nombre'}
        </Button>
      </div>
    </div>
  )
}
