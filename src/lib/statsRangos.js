// Rangos de fecha para Ajustes → Bitácora → Estadísticas. Puro (sin React ni
// Supabase) para poder probarlo, igual que asignaciones.js/mesasUnidas.js.
//
// Todo en tiempo LOCAL de la tablet, como useBitacora.hoyLocal: este proyecto no
// guarda la zona horaria del restaurante en ningún lado, así que la convención de
// siempre es "el reloj de la tablet es el reloj del restaurante" — un rango
// calculado en UTC recortaría el turno de la tarde al día siguiente.

const MS_DIA = 24 * 60 * 60 * 1000

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** 'YYYY-MM-DD' local de una fecha (hoy si no se pasa una). */
export function ymdLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function desdeYMD(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Rango [desde, hasta) de un solo día local, en ISO — igual criterio que
 *  rangoDelDia en useBitacora.js. */
export function rangoDia(ymd) {
  const d = desdeYMD(ymd)
  const siguiente = new Date(d)
  siguiente.setDate(siguiente.getDate() + 1)
  return { desde: d.toISOString(), hasta: siguiente.toISOString() }
}

/** Lunes (local) de la semana que contiene `ymd`. Semana Lunes→Domingo: es como
 *  se piensa una semana de trabajo aquí, no Domingo→Sábado. */
function lunesDe(ymd) {
  const d = desdeYMD(ymd)
  const dow = d.getDay() // 0=Domingo … 6=Sábado
  const delta = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + delta)
  return d
}

/** Rango [lunes, lunes siguiente) de la semana que contiene `ymd`. */
export function rangoSemana(ymd) {
  const lunes = lunesDe(ymd)
  const siguiente = new Date(lunes)
  siguiente.setDate(siguiente.getDate() + 7)
  return { desde: lunes.toISOString(), hasta: siguiente.toISOString() }
}

/** Rango [1º del mes, 1º del mes siguiente) del mes calendario que contiene `ymd`. */
export function rangoMes(ymd) {
  const d = desdeYMD(ymd)
  const inicio = new Date(d.getFullYear(), d.getMonth(), 1)
  const siguiente = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return { desde: inicio.toISOString(), hasta: siguiente.toISOString() }
}

/** Rango [desde, hasta) entre dos días locales, ambos incluidos — para el
 *  selector "Personalizado". */
export function rangoPersonalizado(desdeYmd, hastaYmd) {
  return { desde: desdeYMD(desdeYmd).toISOString(), hasta: rangoDia(hastaYmd).hasta }
}

/** El rango de la MISMA duración, inmediatamente anterior a [desde, hasta). Para
 *  "vs. periodo anterior": ayer si el periodo es hoy, la semana pasada si es esta
 *  semana, el mes pasado si es este mes. */
export function rangoAnterior({ desde, hasta }) {
  const d = new Date(desde)
  const h = new Date(hasta)
  const dur = h.getTime() - d.getTime()
  return { desde: new Date(d.getTime() - dur).toISOString(), hasta: desde }
}

/** El mismo rango, exactamente 7 días antes — "un martes solo se compara con
 *  martes". Con periodos de más de un día da la misma semana un ciclo atrás,
 *  que es lo mismo que rangoAnterior; por eso la pantalla solo la muestra
 *  cuando el periodo es de un día. */
export function rangoSemanaPasada({ desde, hasta }) {
  const SEMANA_MS = 7 * MS_DIA
  return { desde: new Date(new Date(desde).getTime() - SEMANA_MS).toISOString(), hasta: new Date(new Date(hasta).getTime() - SEMANA_MS).toISOString() }
}

/** Rango de los últimos `dias` días completos, terminando hoy inclusive — para
 *  el heatmap hora×día, que necesita varias semanas de patrón y no un mes
 *  calendario en particular. */
export function rangoUltimosDias(dias, ymd = ymdLocal()) {
  const hasta = rangoDia(ymd).hasta
  const desde = desdeYMD(ymd)
  desde.setDate(desde.getDate() - (dias - 1))
  return { desde: desde.toISOString(), hasta }
}

/** Día de la semana (0=Domingo…6=Sábado) y hora (0–23) LOCALES de un momento —
 *  ISO o epoch en milisegundos, lo que sea que `new Date()` acepte — las dos
 *  claves con las que se arma el heatmap y el ranking de días. */
export function diaHoraLocal(momento) {
  const d = new Date(momento)
  return { dow: d.getDay(), hora: d.getHours() }
}

export const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
// Lunes→Domingo para tablas/rankings (el `getDay()` de JS es Domingo→Sábado).
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]

/** Cuántos días tiene el mes calendario que contiene `ymd`. */
export function diasEnMes(ymd) {
  const d = desdeYMD(ymd)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

/** Día del mes (1-based) de `ymd` — cuántos días del mes ya transcurrieron
 *  contando hoy, para la proyección de cierre. */
export function diaDelMes(ymd) {
  return desdeYMD(ymd).getDate()
}
