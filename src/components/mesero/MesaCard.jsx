import { f } from '../../lib/utils'
import { JbFlor } from '../ui/JbFlor'

// Dimensión fija: todas las mesas se ven igual de grandes sin importar su
// estado, y el mapa del piso (MeseroFloorPage) reusa estas mismas medidas
// para calcular posiciones.
export const MESA_CARD_W = 180
export const MESA_CARD_H = 140

// Cada estado visual tiene su propio color, distinto de los demás para que se distingan
// de un vistazo: ámbar = el mesero está armando el pedido (antes de enviarlo), naranja =
// ya se envió pero cocina no lo ha empezado, azul = cocina ya lo está cocinando, teal =
// cocina lo dejó listo (mismo color que "Recogido por Mesero" en cocina, para que se lea
// como el mismo momento de entrega desde los dos lados), rosa = cuenta abierta sin nada
// pendiente en cocina, verde = mesa pagada (el pago se hizo en tali; señal efímera que se
// muestra hasta que el mesero recarga o abre otra cuenta). El verde SOLO se usa para pago.
const THEME = {
  libre:      { bg: '#fff', border: 'var(--jb-line)', label: null, labelColor: 'var(--jb-gray)' },
  preparando: { bg: 'var(--jb-warn-bg)', border: 'var(--jb-warn)', label: 'Armando pedido', labelColor: '#9A6B12' },
  pendiente:  { bg: 'var(--jb-queued-bg)', border: 'var(--jb-queued)', label: 'Pedido enviado', labelColor: '#A8471F' },
  cocinando:  { bg: 'var(--jb-info-bg)', border: 'var(--jb-info)', label: 'En preparación', labelColor: '#2C5F86', pulse: true },
  abierta:    { bg: 'var(--jb-pink-tint)', border: 'var(--jb-pink)', label: 'Cuenta abierta', labelColor: 'var(--jb-pink-dark)' },
  listo:      { bg: 'var(--jb-teal-bg)', border: 'var(--jb-teal)', label: '¡Listo para servir!', labelColor: '#1B5E66', pulse: true, pulseBorder: true },
  pagada:     { bg: 'var(--jb-ok-bg)', border: 'var(--jb-ok)', label: '✓ Pagada', labelColor: '#2C7A50' },
}

export function MesaCard({ mesa, onClick }) {
  // Prioridad: pagada (recién cobrada, señal efímera) manda sobre cualquier estado de
  // cocina que hubiera quedado pintado. Luego: listo > cocinando > pendiente (esperando a
  // que cocina empiece) > lo que diga mesa.estado (abierta/preparando/libre). mesa.estado
  // en sí no cambia por esto — solo se usa para elegir qué tema pintar.
  const visual = mesa.estado === 'pagada'
    ? 'pagada'
    : mesa.tienePedidoListo
    ? 'listo'
    : mesa.tieneEnPreparacion
    ? 'cocinando'
    : mesa.tienePedidoPendiente
    ? 'pendiente'
    : mesa.estado
  const theme = THEME[visual] ?? THEME.libre

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        background: theme.bg,
        border: `3px solid ${theme.pulseBorder ? 'transparent' : theme.border}`,
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
      {theme.pulseBorder && (
        <span
          className="jb-pulse"
          style={{ position: 'absolute', inset: 0, borderRadius: 22, border: `3px solid ${theme.border}`, pointerEvents: 'none' }}
        />
      )}

      <div className="flex items-center justify-between w-full">
        <span style={{ fontSize: 30, fontWeight: 900, color: 'var(--jb-ink)', lineHeight: 1 }}>
          {mesa.numero}
        </span>
        <JbFlor size={22} color={theme.border} />
      </div>

      {theme.label ? (
        <span className={theme.pulse ? 'jb-pulse' : undefined} style={{ fontSize: 14, fontWeight: 800, color: theme.labelColor }}>
          {theme.label}
        </span>
      ) : (
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--jb-gray)' }}>Sin ocupar</span>
      )}

      {mesa.estado === 'abierta' && (
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--jb-pink-dark)' }}>{f(mesa.total)}</span>
      )}
      {mesa.estado === 'pagada' && mesa.total > 0 && (
        <span style={{ fontSize: 20, fontWeight: 800, color: '#2C7A50' }}>{f(mesa.total)}</span>
      )}
    </button>
  )
}
