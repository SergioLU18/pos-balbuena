import { f } from '../../lib/utils'
import { JbFlor } from '../ui/JbFlor'

// Dimensión fija: todas las mesas se ven igual de grandes sin importar su
// estado, y el mapa del piso (MeseroFloorPage) reusa estas mismas medidas
// para calcular posiciones.
export const MESA_CARD_W = 180
export const MESA_CARD_H = 140

const THEME = {
  libre:      { bg: '#fff',            border: 'var(--jb-line)', label: null,               labelColor: 'var(--jb-gray)' },
  preparando: { bg: 'var(--jb-warn-bg)', border: 'var(--jb-warn)', label: 'Preparando orden', labelColor: '#9A6B12' },
  abierta:    { bg: 'var(--jb-pink-tint)', border: 'var(--jb-pink)', label: 'Cuenta abierta', labelColor: 'var(--jb-pink-dark)' },
}

export function MesaCard({ mesa, onClick }) {
  const theme = THEME[mesa.estado] ?? THEME.libre
  const listo = mesa.tienePedidoListo

  return (
    <button
      onClick={onClick}
      style={{
        background: listo ? 'var(--jb-ok-bg)' : theme.bg,
        border: `3px solid ${listo ? 'var(--jb-ok)' : theme.border}`,
        borderRadius: 22,
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: "'Inter Tight', sans-serif",
        width: MESA_CARD_W,
        height: MESA_CARD_H,
        transition: 'transform 0.1s ease',
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <div className="flex items-center justify-between w-full">
        <span style={{ fontSize: 30, fontWeight: 900, color: 'var(--jb-ink)', lineHeight: 1 }}>
          {mesa.numero}
        </span>
        <JbFlor size={22} color={listo ? 'var(--jb-ok)' : theme.border} />
      </div>

      {listo ? (
        <span className="jb-pulse" style={{ fontSize: 14, fontWeight: 800, color: '#1F7A48' }}>
          ¡Listo para servir!
        </span>
      ) : theme.label ? (
        <span style={{ fontSize: 14, fontWeight: 700, color: theme.labelColor }}>{theme.label}</span>
      ) : (
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--jb-gray)' }}>Sin ocupar</span>
      )}

      {mesa.estado === 'abierta' && (
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--jb-pink-dark)' }}>{f(mesa.total)}</span>
      )}
    </button>
  )
}
