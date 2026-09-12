import { f } from '../../lib/utils'
import { nombreGrupo } from '../../lib/mesasUnidas'
import { JbFlor } from '../ui/JbFlor'

// MESA_CARD_W es el ancho MÍNIMO de la tarjeta: el listado del piso usa una
// cuadrícula que estira las tarjetas para llenar el espacio disponible según
// cuántas mesas haya. La altura sí es fija para que el listado quede parejo.
export const MESA_CARD_W = 180
export const MESA_CARD_H = 158

// Solo dos estados de cuenta se ven desde el piso (el detalle de cocina — armando,
// enviado, cocinando, listo — vive en CocinaPage, no aquí): rosa = cuenta abierta, en
// cualquier parte del proceso; verde = mesa pagada (en tali o a mano por el mesero;
// señal efímera que se apaga sola a los 3 minutos o al abrir una cuenta nueva, ver
// useMesaPagadaStore). Gris punteado = mesa unida a otra: no tiene estado propio, todo
// vive en su principal.
const THEME = {
  libre:   { bg: '#fff', border: 'var(--jb-line)', label: null, labelColor: 'var(--jb-gray)' },
  abierta: { bg: 'var(--jb-pink-tint)', border: 'var(--jb-pink)', label: 'Cuenta abierta', labelColor: 'var(--jb-pink-dark)' },
  pagada:  { bg: 'var(--jb-ok-bg)', border: 'var(--jb-ok)', label: '✓ Pagada', labelColor: '#2C7A50' },
  unida:   { bg: 'var(--jb-cream)', border: 'var(--jb-gray)', label: null, labelColor: 'var(--jb-ink-soft)', dashed: true },
}

/** `seleccionada` y `deshabilitada` solo se usan en el modo "Unir mesas" del piso. */
export function MesaCard({ mesa, meseroActualId, onClick, seleccionada = false, deshabilitada = false }) {
  // La secundaria de un grupo unido no tiene estado propio: todo vive en su principal.
  const visual = mesa.unidaA ? 'unida' : mesa.estado
  const theme = THEME[visual] ?? THEME.libre
  // La principal lleva el nombre del grupo completo ("3 + 4") para que en el piso se lea
  // que ahí están sentadas las dos.
  const nombre = nombreGrupo(mesa.numero, mesa.unidas)

  return (
    <button
      onClick={onClick}
      disabled={deshabilitada}
      style={{
        position: 'relative',
        background: theme.bg,
        border: `3px ${theme.dashed ? 'dashed' : 'solid'} ${theme.border}`,
        borderRadius: 22,
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        cursor: deshabilitada ? 'not-allowed' : 'pointer',
        opacity: deshabilitada ? 0.35 : 1,
        boxShadow: seleccionada ? '0 0 0 4px var(--jb-pink)' : undefined,
        textAlign: 'left',
        fontFamily: "'Inter Tight', sans-serif",
        width: '100%',
        height: MESA_CARD_H,
        transition: 'transform 0.1s ease',
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {seleccionada && (
        <span
          style={{
            position: 'absolute', top: -10, right: -10, width: 28, height: 28, borderRadius: 14,
            background: 'var(--jb-pink)', color: '#fff', fontSize: 16, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✓
        </span>
      )}

      <div className="flex items-center justify-between w-full">
        {/* El nombre de la mesa puede traer letras ("Terraza 2"), así que se encoge
            cuando es largo en vez de desbordarse. */}
        <span style={{
          fontSize: nombre.length > 4 ? 19 : 30,
          fontWeight: 900, color: 'var(--jb-ink)', lineHeight: 1.1,
          overflowWrap: 'anywhere',
        }}>
          {nombre}
        </span>
        <JbFlor size={22} color={theme.border} />
      </div>

      {visual === 'unida' ? (
        <span style={{ fontSize: 14, fontWeight: 800, color: theme.labelColor }}>
          🔗 Unida a Mesa {mesa.unidaA.numero}
        </span>
      ) : theme.label ? (
        <span style={{ fontSize: 14, fontWeight: 800, color: theme.labelColor }}>
          {theme.label}
        </span>
      ) : (
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--jb-gray)' }}>Sin ocupar</span>
      )}

      {visual !== 'unida' && mesa.estado === 'abierta' && (
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--jb-pink-dark)' }}>{f(mesa.total)}</span>
      )}
      {visual !== 'unida' && mesa.estado === 'pagada' && mesa.total > 0 && (
        <span style={{ fontSize: 20, fontWeight: 800, color: '#2C7A50' }}>{f(mesa.total)}</span>
      )}

      {/* Quién atiende la mesa. Pueden ser varios: dos meseros que se reparten el
          salón, o uno que le cubre la mesa a otro. El propio nombre va resaltado para
          poder barrer el mapa y ubicar las suyas sin leer nombre por nombre.
          marginTop:auto lo ancla abajo, tenga o no total arriba. */}
      {mesa.meseros?.length > 0 && (
        <span
          style={{
            marginTop: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--jb-gray)',
            maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {mesa.meseros.map((w, i) => (
            <span
              key={w.id}
              style={w.id === meseroActualId ? { fontWeight: 800, color: 'var(--jb-pink-dark)' } : undefined}
            >
              {i > 0 && <span style={{ color: 'var(--jb-line)' }}> · </span>}
              {w.nombre}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}
