import { useMemo } from 'react'
import { BarChart, Bar, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Section, AvisoVacio } from './Section'
import { f } from '../../../lib/utils'
import { ventaPorDiaSemana, serieMensualConProyeccion } from '../../../lib/statsCalc'

const ROSA = '#EA478A'
const ROSA_SUAVE = '#F9BFD7'

const tooltipEstilo = { fontFamily: "'Inter Tight', sans-serif", fontSize: 13, borderRadius: 10, border: '2px solid var(--jb-line)' }
const ejeEstilo = { fontFamily: "'Inter Tight', sans-serif", fontSize: 11, fill: 'var(--jb-ink-soft)', fontWeight: 700 }

/** El mes calendario en curso, siempre — no lo mueve el selector Hoy/Semana/Mes
 *  de arriba: "venta acumulada del MES" y "proyección de cierre" solo tienen
 *  sentido hablando del mes de verdad. */
export function PatronesMes({ serie, diaDelMes, diasEnMes, cargando }) {
  const porDiaSemana = useMemo(() => ventaPorDiaSemana(serie), [serie])
  const { puntos, proyeccionFinal, hoyAcumulado } = useMemo(
    () => serieMensualConProyeccion(serie, diaDelMes, diasEnMes),
    [serie, diaDelMes, diasEnMes]
  )
  const hoyDow = new Date().getDay()
  const hayDatos = serie.length > 0

  return (
    <Section title="Patrones del mes" subtitle="Días fuertes y hacia dónde va el mes.">
      {cargando && !serie.length ? (
        <AvisoVacio>Cargando…</AvisoVacio>
      ) : !hayDatos ? (
        <AvisoVacio>Sin ventas cerradas este mes.</AvisoVacio>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 800, color: 'var(--jb-ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Ranking de días de la semana
            </h4>
            <div style={{ width: '100%', height: 170 }}>
              <ResponsiveContainer>
                <BarChart data={porDiaSemana} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--jb-line)" />
                  <XAxis dataKey="nombre" tickFormatter={(n) => n.slice(0, 3)} tick={ejeEstilo} axisLine={{ stroke: 'var(--jb-line)' }} tickLine={false} />
                  <YAxis tick={ejeEstilo} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} width={44} />
                  <Tooltip formatter={(v) => f(v)} labelFormatter={(n) => n} contentStyle={tooltipEstilo} cursor={{ fill: 'var(--jb-pink-tint)' }} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {porDiaSemana.map((d) => <Cell key={d.dow} fill={d.dow === hoyDow ? ROSA : ROSA_SUAVE} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between flex-wrap" style={{ gap: 8, marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: 'var(--jb-ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Venta acumulada del mes
              </h4>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--jb-ink-soft)' }}>
                Va en <strong style={{ color: 'var(--jb-ink)' }}>{f(hoyAcumulado)}</strong> · proyección de cierre:{' '}
                <strong style={{ color: 'var(--jb-pink-dark)' }}>{f(proyeccionFinal)}</strong>
              </span>
            </div>
            <div style={{ width: '100%', height: 190 }}>
              <ResponsiveContainer>
                <AreaChart data={puntos} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stats-acumulado-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ROSA} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={ROSA} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--jb-line)" />
                  <XAxis dataKey="dia" tick={ejeEstilo} axisLine={{ stroke: 'var(--jb-line)' }} tickLine={false} interval={4} />
                  <YAxis tick={ejeEstilo} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} width={44} />
                  <Tooltip
                    formatter={(v, nombre) => [v == null ? '—' : f(v), nombre === 'real' ? 'Acumulado' : 'Proyección']}
                    labelFormatter={(d) => `Día ${d}`}
                    contentStyle={tooltipEstilo}
                  />
                  <Area type="monotone" dataKey="real" stroke={ROSA} strokeWidth={2.5} fill="url(#stats-acumulado-fill)" dot={false} connectNulls={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="proyectado" stroke={ROSA} strokeWidth={2.5} strokeDasharray="5 5" fill="none" dot={false} connectNulls isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}
