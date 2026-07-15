/** Format number as $1,234.50 */
export function f(n) {
  if (n == null || isNaN(n)) return '$0.00'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Format date as "12 mar 2025" */
export function fdate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Clamp a value between min and max */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

/** Simple client-side id generator for draft/mock entities */
export function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`
}

/** Minutos transcurridos desde una fecha ISO, como texto corto ("ahora", "7 min"). */
export function minutosTranscurridos(iso) {
  if (!iso) return ''
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  return min < 1 ? 'ahora' : `${min} min`
}

/** Cronómetro en vivo desde una fecha ISO, en formato MIN:SEG ("00:00", "05:12") —
 *  para las tarjetas de cocina, que necesitan ver los segundos avanzar. */
export function cronometro(iso) {
  if (!iso) return '00:00'
  const totalSeg = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  const min = Math.floor(totalSeg / 60)
  const seg = totalSeg % 60
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
}

/** Duración congelada entre dos fechas ISO (a diferencia de minutosTranscurridos,
 *  no depende de "ahora" — sirve para guardar/mostrar cuánto tardó una etapa ya
 *  cerrada, p. ej. cuánto esperó un pedido "listo" antes de que lo recogieran). */
export function duracionMin(inicioIso, finIso) {
  if (!inicioIso || !finIso) return ''
  const min = Math.floor((new Date(finIso).getTime() - new Date(inicioIso).getTime()) / 60000)
  return min < 1 ? '<1 min' : `${min} min`
}
