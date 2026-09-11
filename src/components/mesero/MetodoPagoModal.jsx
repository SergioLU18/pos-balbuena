import { Button } from '../ui/Button'

const METODOS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'otro', label: 'Otro' },
]

// Segundo paso al cerrar una mesa: una vez confirmado el cierre (ConfirmModal), el
// mesero elige con qué se pagó. Botones grandes y apilados para que funcionen igual
// en tablet vertical u horizontal.
export function MetodoPagoModal({ titulo = '¿Cómo pagó la mesa?', onSelect, onClose }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20,
      }}
    >
      <div
        className="jb-pop"
        style={{
          background: '#fff', borderRadius: 26, width: 440, maxWidth: '100%',
          fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
          padding: '28px 30px', display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>{titulo}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {METODOS.map((m) => (
            <Button key={m.id} variant="secondary" size="lg" onClick={() => onSelect(m.id)} style={{ width: '100%' }}>
              {m.label}
            </Button>
          ))}
        </div>

        <Button variant="ghost" size="md" onClick={onClose} style={{ marginTop: 4 }}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
