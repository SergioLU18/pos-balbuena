import { Section, AvisoVacio } from './Section'
import { f } from '../../../lib/utils'
import { CATEGORICO, OTROS } from '../../../lib/statsColors'

/** Venta por mesero, tickets atendidos y ticket promedio — de lo ENVIADO a
 *  cocina (orden.enviar), no de quién cerró la cuenta: si se cerró solo lo
 *  atribuiría a "Pago en tali" y el mesero que sí atendió la mesa se quedaría
 *  sin crédito (ver el comentario grande de arriba de stats.sql). */
export function VentaPorMesero({ datos, cargando }) {
  const filas = datos ?? []
  const top = filas.slice(0, 8)
  const resto = filas.slice(8)
  const lista = resto.length
    ? [...top, {
        mesero_nombre: `Otros (${resto.length})`,
        venta: resto.reduce((s, m) => s + Number(m.venta), 0),
        tickets: resto.reduce((s, m) => s + Number(m.tickets), 0),
        _otros: true,
      }]
    : top
  const maximo = Math.max(...lista.map((m) => Number(m.venta) || 0), 1)

  return (
    <Section title="Venta por mesero" subtitle="Lo que cada quien mandó a cocina — no baja lo que se canceló después.">
      {cargando && !datos ? (
        <AvisoVacio>Cargando…</AvisoVacio>
      ) : !lista.length ? (
        <AvisoVacio>Nadie envió comandas en este periodo.</AvisoVacio>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
          {lista.map((m, i) => {
            const tickets = Number(m.tickets) || 0
            const venta = Number(m.venta) || 0
            const promedio = tickets > 0 ? venta / tickets : 0
            return (
              <li key={m.mesero_id ?? m.mesero_nombre}>
                <div className="flex items-center justify-between" style={{ gap: 10, fontSize: 14, marginBottom: 5 }}>
                  <span style={{ fontWeight: 800, color: 'var(--jb-ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.mesero_nombre}
                  </span>
                  <span style={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0, color: 'var(--jb-ink)' }}>
                    {f(venta)} <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--jb-ink-soft)' }}>· {tickets} tk · {f(promedio)} prom.</span>
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: 'var(--jb-line)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(venta / maximo) * 100}%`, background: m._otros ? OTROS : CATEGORICO[i % CATEGORICO.length], borderRadius: 999 }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
