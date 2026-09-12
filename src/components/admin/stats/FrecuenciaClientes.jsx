import { Section, AvisoVacio } from './Section'
import { ORDINAL_TEAL } from '../../../lib/statsColors'

const BUCKETS = [
  { clave: 'una_vez', nombre: '1 vez', color: ORDINAL_TEAL[0] },
  { clave: 'dos_a_tres', nombre: '2-3 veces', color: ORDINAL_TEAL[1] },
  { clave: 'cuatro_mas', nombre: '4+ veces', color: ORDINAL_TEAL[2] },
]

/** Cuántos clientes compraron 1 vez, 2-3 o 4+ — de siempre, no por periodo (ver
 *  pos_stats_clientes_frecuencia). Es, necesariamente, "clientes PARA LLEVAR":
 *  una mesa pagada en el salón, con tali o sin él, no queda ligada a ningún
 *  cliente en esta base — el padrón de tali es otro sistema. */
export function FrecuenciaClientes({ datos, cargando }) {
  const total = Number(datos?.total_clientes ?? 0)

  return (
    <Section
      title="Frecuencia de compra"
      subtitle="Clientes para llevar — es el único cliente que el POS identifica; una mesa del salón (con tali o sin él) no queda ligada a nadie aquí."
    >
      {cargando && !datos ? (
        <AvisoVacio>Cargando…</AvisoVacio>
      ) : !total ? (
        <AvisoVacio>Aún no hay órdenes para llevar entregadas con cliente identificado.</AvisoVacio>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
          {BUCKETS.map((b) => {
            const n = Number(datos?.[b.clave] ?? 0)
            const pct = (n / total) * 100
            return (
              <li key={b.clave}>
                <div className="flex items-center justify-between" style={{ fontSize: 14, marginBottom: 5 }}>
                  <span style={{ fontWeight: 800, color: 'var(--jb-ink)' }}>{b.nombre}</span>
                  <span style={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'var(--jb-ink)' }}>
                    {n.toLocaleString('es-MX')} <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--jb-ink-soft)' }}>({Math.round(pct)}%)</span>
                  </span>
                </div>
                <div style={{ height: 12, borderRadius: 999, background: 'var(--jb-line)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: b.color, borderRadius: 999 }} />
                </div>
              </li>
            )
          })}
          <li style={{ fontSize: 12.5, color: 'var(--jb-ink-soft)', fontWeight: 700, paddingTop: 2 }}>
            {total.toLocaleString('es-MX')} cliente{total === 1 ? '' : 's'} con al menos una entrega.
          </li>
        </ul>
      )}
    </Section>
  )
}
