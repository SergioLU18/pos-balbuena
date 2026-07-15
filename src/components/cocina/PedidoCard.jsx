import { useClock } from '../../hooks/useClock'
import { minutosTranscurridos } from '../../lib/utils'
import { describirMitades } from '../../lib/describirItem'
import { Button } from '../ui/Button'

const SIGUIENTE = {
  pendiente: { label: 'Empezar a preparar', estado: 'preparando', variant: 'primary' },
  preparando: { label: 'Marcar listo', estado: 'listo', variant: 'ok' },
  listo: { label: 'Recogido por Mesero', estado: 'entregado', variant: 'teal' },
}

// Desde cuándo corre el cronómetro de la tarjeta: se reinicia en cada columna en vez
// de mostrar siempre el tiempo total desde que se envió el pedido. Cae de vuelta a
// enviadoAt si por lo que sea falta la marca de la columna (pedidos viejos, o si el
// pedido saltó directo a un estado sin haber pasado registro de la columna anterior).
function inicioColumna(pedido) {
  if (pedido.estado === 'preparando') return pedido.preparandoAt ?? pedido.enviadoAt
  if (pedido.estado === 'listo') return pedido.listoAt ?? pedido.enviadoAt
  return pedido.enviadoAt
}

function urgencia(inicioAt) {
  const min = Math.floor((Date.now() - new Date(inicioAt).getTime()) / 60000)
  if (min >= 10) return { border: '#C24A4A', bg: '#FCEAEA', text: '#A83232' }
  if (min >= 5) return { border: 'var(--jb-warn)', bg: 'var(--jb-warn-bg)', text: '#9A6B12' }
  return { border: 'var(--jb-line)', bg: '#fff', text: 'var(--jb-gray)' }
}

export function ItemLine({ item }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1.5px dashed var(--jb-line)' }}>
      <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--jb-ink)' }}>
        {item.cantidad > 1 ? `${item.cantidad}× ` : ''}{item.platilloNombre} · {item.tier.nombre}
      </span>
      {describirMitades(item).map(({ lado, prefijo, texto }) => (
        <p key={lado} style={{ margin: '3px 0 0', fontSize: 14, color: 'var(--jb-ink-soft)' }}>
          {prefijo}{texto}
        </p>
      ))}
      {item.nota && (
        <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--jb-pink-dark)' }}>“{item.nota}”</p>
      )}
    </div>
  )
}

export function PedidoCard({ pedido, onAvanzar }) {
  useClock() // fuerza el re-render periódico para refrescar el tiempo transcurrido
  const inicio = inicioColumna(pedido)
  const u = urgencia(inicio)
  const accion = SIGUIENTE[pedido.estado]

  return (
    <div
      className="jb-fade-up"
      style={{
        background: '#fff', border: `3px solid ${u.border}`, borderRadius: 22,
        padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
        fontFamily: "'Inter Tight', sans-serif",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-baseline" style={{ gap: 10 }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--jb-ink)' }}>Mesa {pedido.mesaNumero}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--jb-ink-soft)' }}>{pedido.meseroNombre}</span>
        </div>
        <span
          style={{
            fontSize: 13, fontWeight: 800, color: u.text, background: u.bg,
            border: `1.5px solid ${u.border}`, borderRadius: 20, padding: '4px 12px', flexShrink: 0,
          }}
        >
          {minutosTranscurridos(inicio)}
        </span>
      </div>

      <div>
        {pedido.items.map((item) => <ItemLine key={item.id} item={item} />)}
      </div>

      <Button variant={accion.variant} onClick={() => onAvanzar(pedido.id, accion.estado)} style={{ width: '100%' }}>
        {accion.label}
      </Button>
    </div>
  )
}
