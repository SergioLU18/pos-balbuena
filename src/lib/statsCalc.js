// Cálculos puros sobre lo que devuelven las RPC `pos_stats_*` (ver
// supabase/stats.sql) — separado de statsRangos.js (que solo arma rangos de
// fecha) para poder probar cada cuenta suelta, sin React ni Supabase.
import { diaHoraLocal, ymdLocal, NOMBRES_DIA, ORDEN_SEMANA } from './statsRangos'

/** Total, cuentas y ticket promedio de un pos_stats_resumen — que trae salón y
 *  llevar por separado porque el corte por método de pago solo aplica al salón
 *  (ver el comentario de arriba de stats.sql). */
export function totalesResumen(r) {
  if (!r) return { total: 0, cuentas: 0, ticketPromedio: 0 }
  const total = Number(r.salon_total ?? 0) + Number(r.llevar_total ?? 0)
  const cuentas = Number(r.salon_cuentas ?? 0) + Number(r.llevar_cuentas ?? 0)
  return { total, cuentas, ticketPromedio: cuentas > 0 ? total / cuentas : 0 }
}

/** Proyección lineal de cierre de mes: lo acumulado, prorrateado a los días que
 *  tiene el mes completo. A propósito simple — no distingue fin de semana de
 *  entre semana, solo da un "para dónde va" mientras el mes corre. */
export function proyeccionCierre(acumulado, diasTranscurridos, diasDelMes) {
  if (diasTranscurridos <= 0) return 0
  return (acumulado / diasTranscurridos) * diasDelMes
}

/** Bucketiza una serie de pos_stats_ventas_serie en una grilla 7×24 [dow][hora]
 *  de { total, cuentas }, en hora LOCAL (ver diaHoraLocal). `dow` sigue el índice
 *  de JS (0=Domingo…6=Sábado) — se reordena a Lunes→Domingo al pintar, con
 *  ORDEN_SEMANA. */
export function bucketizarHeatmap(serie) {
  const grilla = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ total: 0, cuentas: 0 })))
  for (const punto of serie) {
    const { dow, hora } = diaHoraLocal(punto.ocurrido_at)
    grilla[dow][hora].total += Number(punto.total) || 0
    grilla[dow][hora].cuentas += 1
  }
  return grilla
}

/** Venta total por día de la semana, Lunes→Domingo, de la misma serie. */
export function ventaPorDiaSemana(serie) {
  const totales = Array(7).fill(0)
  for (const punto of serie) {
    const { dow } = diaHoraLocal(punto.ocurrido_at)
    totales[dow] += Number(punto.total) || 0
  }
  return ORDEN_SEMANA.map((dow) => ({ dow, nombre: NOMBRES_DIA[dow], total: totales[dow] }))
}

/** Serie diaria del mes (un punto por día con ventas, en orden) con el
 *  acumulado corrido — lista para la línea de "venta acumulada del mes". */
export function acumuladoDiario(serie) {
  const porDia = new Map()
  for (const punto of serie) {
    const dia = ymdLocal(new Date(punto.ocurrido_at))
    porDia.set(dia, (porDia.get(dia) ?? 0) + (Number(punto.total) || 0))
  }
  const dias = [...porDia.keys()].sort()
  let acumulado = 0
  return dias.map((dia) => {
    const total = porDia.get(dia)
    acumulado += total
    return { dia, total, acumulado }
  })
}

/** Serie día 1..diasDelMes con el acumulado REAL hasta hoy y, desde hoy, una
 *  proyección lineal a fin de mes — para la gráfica de "venta acumulada del
 *  mes con proyección de cierre". Los dos tramos comparten el punto de "hoy"
 *  (los dos campos vienen llenos ahí) para que la línea se dibuje continua en
 *  vez de con un salto entre lo real y lo proyectado. */
export function serieMensualConProyeccion(serie, diasTranscurridos, diasDelMes) {
  const porDiaDelMes = new Map()
  for (const punto of serie) {
    const dia = new Date(punto.ocurrido_at).getDate() // día del mes, hora LOCAL
    porDiaDelMes.set(dia, (porDiaDelMes.get(dia) ?? 0) + (Number(punto.total) || 0))
  }

  let corrido = 0
  const acumuladoReal = []
  for (let d = 1; d <= diasTranscurridos; d++) {
    corrido += porDiaDelMes.get(d) ?? 0
    acumuladoReal.push(corrido)
  }
  const hoyAcumulado = acumuladoReal[acumuladoReal.length - 1] ?? 0
  const proyeccionFinal = proyeccionCierre(hoyAcumulado, diasTranscurridos, diasDelMes)
  const diasRestantes = diasDelMes - diasTranscurridos
  const pendientePorDia = diasRestantes > 0 ? (proyeccionFinal - hoyAcumulado) / diasRestantes : 0

  const puntos = []
  for (let d = 1; d <= diasDelMes; d++) {
    puntos.push({
      dia: d,
      real: d <= diasTranscurridos ? acumuladoReal[d - 1] : null,
      proyectado: d < diasTranscurridos ? null : hoyAcumulado + pendientePorDia * (d - diasTranscurridos),
    })
  }
  return { puntos, hoyAcumulado, proyeccionFinal }
}
