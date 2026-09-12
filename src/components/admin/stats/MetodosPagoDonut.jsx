import { PieChart, Pie, Cell, Tooltip, Sector } from 'recharts'
import { Section, AvisoVacio } from './Section'
import { f } from '../../../lib/utils'
import { CATEGORICO_DONA } from '../../../lib/statsColors'

const CATEGORIAS = [
  { clave: 'metodo_efectivo', cuentasClave: 'metodo_efectivo_cuentas', nombre: 'Efectivo', color: CATEGORICO_DONA[0] },
  { clave: 'metodo_tarjeta', cuentasClave: 'metodo_tarjeta_cuentas', nombre: 'Tarjeta', color: CATEGORICO_DONA[1] },
  { clave: 'metodo_ambos', cuentasClave: 'metodo_ambos_cuentas', nombre: 'Mixto (efectivo + tarjeta)', color: CATEGORICO_DONA[2] },
  { clave: 'metodo_tali', cuentasClave: 'metodo_tali_cuentas', nombre: 'Tali', color: CATEGORICO_DONA[3] },
]

// Sombreado que confirma la rebanada tocada, sin recolorear: los datos de
// recharts ya traen el `fill` de cada rebanada, esta función solo lo oscurece
// un poco al pasar el mouse/dedo (ver dataviz/interaction.md — hover en toda
// forma interactiva, hit-target más grande que la marca).
function activeShape(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} />
}

/** Cómo se pagó el salón: efectivo / tarjeta / mixto / tali, con monto de cada
 *  uno — más abajo, el corte real para cuadrar caja. Para llevar no trae método
 *  de pago (ver stats.sql), así que esta gráfica es solo de mesas. */
export function MetodosPagoDonut({ resumen, cargando }) {
  if (cargando && !resumen) {
    return <Section title="Métodos de pago" subtitle="Solo salón — para llevar no registra cómo se pagó."><AvisoVacio>Cargando…</AvisoVacio></Section>
  }

  const filas = CATEGORIAS
    .map((c) => ({ ...c, valor: Number(resumen?.[c.clave] ?? 0), cuentas: Number(resumen?.[c.cuentasClave] ?? 0) }))
    .filter((c) => c.valor > 0)
  const total = filas.reduce((s, c) => s + c.valor, 0)

  return (
    <Section title="Métodos de pago" subtitle="Solo salón — para llevar no registra cómo se pagó.">
      {!total ? (
        <AvisoVacio>Sin mesas cerradas en este periodo.</AvisoVacio>
      ) : (
        <>
          <div className="flex items-center flex-wrap" style={{ gap: 20 }}>
            <div style={{ width: 168, height: 168, flexShrink: 0 }}>
              <PieChart width={168} height={168}>
                <Pie
                  data={filas} dataKey="valor" nameKey="nombre" cx="50%" cy="50%"
                  innerRadius={52} outerRadius={80} paddingAngle={3} cornerRadius={4}
                  stroke="var(--jb-cream)" strokeWidth={2}
                  activeShape={activeShape}
                >
                  {filas.map((c) => <Cell key={c.clave} fill={c.color} />)}
                </Pie>
                <Tooltip
                  formatter={(valor, _n, item) => [`${f(valor)} · ${item.payload.cuentas} cuenta${item.payload.cuentas === 1 ? '' : 's'}`, item.payload.nombre]}
                  contentStyle={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 13, borderRadius: 10, border: '2px solid var(--jb-line)' }}
                />
              </PieChart>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 200 }}>
              {filas.map((c) => (
                <li key={c.clave} className="flex items-center justify-between" style={{ gap: 10, fontSize: 14 }}>
                  <span className="flex items-center" style={{ gap: 8, fontWeight: 800, color: 'var(--jb-ink)', minWidth: 0 }}>
                    <span aria-hidden style={{ width: 11, height: 11, borderRadius: 999, background: c.color, flexShrink: 0 }} />
                    {c.nombre}
                  </span>
                  <span style={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'var(--jb-ink)', whiteSpace: 'nowrap' }}>
                    {f(c.valor)} <span style={{ color: 'var(--jb-ink-soft)', fontWeight: 700, fontSize: 12.5 }}>({Math.round((c.valor / total) * 100)}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p style={{
            margin: 0, fontSize: 13, color: 'var(--jb-ink-soft)', background: 'var(--jb-cream)',
            borderRadius: 12, padding: '11px 14px', lineHeight: 1.45,
          }}>
            Para cuadrar caja: <strong style={{ color: 'var(--jb-ink)' }}>{f(resumen.caja_efectivo)}</strong> en efectivo
            {' '}y <strong style={{ color: 'var(--jb-ink)' }}>{f(resumen.caja_tarjeta)}</strong> en tarjeta
            {' '}(reparte lo mixto entre los dos).
          </p>
        </>
      )}
    </Section>
  )
}
