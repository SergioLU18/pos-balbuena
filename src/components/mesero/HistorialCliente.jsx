import { useState } from 'react'
import { f, fdate } from '../../lib/utils'

// Nombre legible de un renglón guardado en el historial. Los renglones se congelan al
// cerrar la orden con la misma forma que se mandaron a cocina, así que traen `nombre`
// (el facturable, con tier y personalización) — pero se cae al armado por partes por si
// una orden vieja se guardó sin él.
function nombreRenglon(item) {
  if (item.nombre) return item.nombre
  const tier = item.tier?.nombre
  return tier ? `${item.platilloNombre} · ${tier}` : (item.platilloNombre ?? 'Platillo')
}

/** Historial de compras del cliente. No es adorno: es lo que deja que el mesero diga
 *  "¿le repito lo de siempre?" y que el cliente no tenga que volver a dictar su pedido
 *  de cada semana. Por eso cada orden se puede desplegar para ver sus platillos. */
export function HistorialCliente({ historial, cargando }) {
  const [abierta, setAbierta] = useState(null)

  if (cargando) {
    return <p style={{ margin: 0, fontSize: 14, color: 'var(--jb-gray)' }}>Cargando historial…</p>
  }
  if (!historial?.length) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: 'var(--jb-gray)' }}>
        Sin órdenes anteriores — es su primera vez.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {historial.map((orden) => {
        const desplegada = abierta === orden.id
        const cancelada = orden.estado === 'cancelada'
        return (
          <div
            key={orden.id}
            style={{
              border: '2px solid var(--jb-line)', borderRadius: 14, background: '#fff', overflow: 'hidden',
              opacity: cancelada ? 0.6 : 1,
            }}
          >
            <button
              onClick={() => setAbierta(desplegada ? null : orden.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Inter Tight', sans-serif", textAlign: 'left',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: 'var(--jb-ink)' }}>
                  {fdate(orden.closedAt ?? orden.createdAt)}
                  {cancelada && <span style={{ color: '#C24A4A', fontWeight: 700 }}> · cancelada</span>}
                </span>
                <span style={{ fontSize: 13, color: 'var(--jb-ink-soft)' }}>
                  L-{orden.folio} · {(orden.items ?? []).length} {(orden.items ?? []).length === 1 ? 'platillo' : 'platillos'}
                </span>
              </span>
              <span className="flex items-center" style={{ gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--jb-ink)' }}>{f(orden.total)}</span>
                <span style={{ fontSize: 12, color: 'var(--jb-gray)' }}>{desplegada ? '▲' : '▼'}</span>
              </span>
            </button>

            {desplegada && (
              <div style={{ padding: '0 14px 12px', borderTop: '1.5px dashed var(--jb-line)' }}>
                {(orden.items ?? []).length === 0 ? (
                  <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--jb-gray)' }}>
                    Esta orden se cerró sin platillos.
                  </p>
                ) : (
                  (orden.items ?? []).map((item, i) => (
                    <p key={item.id ?? i} style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--jb-ink-soft)' }}>
                      {item.cantidad > 1 ? `${item.cantidad}× ` : ''}{nombreRenglon(item)}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
