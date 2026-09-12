import { Section, StatTile, Comparativo, AvisoVacio } from './Section'
import { totalesResumen } from '../../../lib/statsCalc'
import { f } from '../../../lib/utils'
import { CATEGORICO } from '../../../lib/statsColors'

/** Total del periodo, cuentas cerradas y ticket promedio — con su comparación
 *  contra el periodo anterior y, solo cuando el periodo es "Hoy", contra el
 *  mismo día de la semana pasada ("un martes solo se compara con martes"). */
export function ResumenCards({ actual, anterior, semanaPasada, etiquetaAnterior, etiquetaSemanaPasada, cargando }) {
  const t = totalesResumen(actual)
  const tAnterior = anterior ? totalesResumen(anterior) : null
  const tSemanaPasada = semanaPasada ? totalesResumen(semanaPasada) : null

  return (
    <Section title="Venta del periodo" subtitle="Salón y para llevar juntos.">
      {cargando && !actual ? (
        <AvisoVacio>Cargando…</AvisoVacio>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 20 }}>
            <StatTile label="Total" valor={f(t.total)} acento>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Comparativo actual={t.total} anterior={tAnterior?.total} etiqueta={etiquetaAnterior} />
                {etiquetaSemanaPasada && <Comparativo actual={t.total} anterior={tSemanaPasada?.total} etiqueta={etiquetaSemanaPasada} />}
              </div>
            </StatTile>
            <StatTile label="Cuentas cerradas" valor={t.cuentas.toLocaleString('es-MX')}>
              <Comparativo actual={t.cuentas} anterior={tAnterior?.cuentas} etiqueta={etiquetaAnterior} />
            </StatTile>
            <StatTile label="Ticket promedio" valor={f(t.ticketPromedio)}>
              <Comparativo actual={t.ticketPromedio} anterior={tAnterior?.ticketPromedio} etiqueta={etiquetaAnterior} />
            </StatTile>
          </div>
          <SalonVsLlevar resumen={actual} />
        </>
      )}
    </Section>
  )
}

function SalonVsLlevar({ resumen }) {
  const salon = Number(resumen?.salon_total ?? 0)
  const llevar = Number(resumen?.llevar_total ?? 0)
  const total = salon + llevar
  if (!total) return null
  const pctSalon = (salon / total) * 100

  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', border: '2px solid var(--jb-line)' }}>
        <div style={{ width: `${pctSalon}%`, background: CATEGORICO[0] }} />
        <div style={{ width: `${100 - pctSalon}%`, background: CATEGORICO[1] }} />
      </div>
      <div className="flex items-center justify-between flex-wrap" style={{ marginTop: 9, gap: 6, fontSize: 13.5, fontWeight: 700, color: 'var(--jb-ink-soft)' }}>
        <span><Punto color={CATEGORICO[0]} /> Salón · {f(salon)} ({Math.round(pctSalon)}%)</span>
        <span><Punto color={CATEGORICO[1]} /> Para llevar · {f(llevar)} ({Math.round(100 - pctSalon)}%)</span>
      </div>
    </div>
  )
}

function Punto({ color }) {
  return <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: color, marginRight: 5 }} />
}
