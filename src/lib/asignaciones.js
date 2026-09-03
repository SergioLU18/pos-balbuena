/** Quién atiende qué mesa, como lista plana de pares `{ mesaId, meseroId }` — el
 *  espejo en memoria de la tabla `mesa_meseros`.
 *
 *  Una mesa puede tener VARIOS meseros (dos que se reparten el salón, o uno que le
 *  cubre la mesa a otro), y un mesero varias mesas: la relación es muchos-a-muchos
 *  en los dos sentidos. El PEDIDO no — ese siempre tiene un solo mesero, el que lo
 *  mandó (`pedido.meseroId`), y es de ahí de donde salen los avisos personales.
 *
 *  Antes esto era `mesero.mesas`, un arreglo de NÚMEROS de mesa colgado de cada
 *  mesero. Se movió a pares de ids porque el número es editable y reciclable
 *  (renombrar una mesa reasignaba en silencio la del mismo número) y porque desde
 *  un arreglo por mesero no había forma de preguntar "¿quiénes atienden esta mesa?"
 *  sin recorrer el catálogo entero.
 *
 *  Todas las funciones son puras: reciben la lista y devuelven una nueva. Así el
 *  modo mock (que muta el store) y el modo backend (que recarga desde Supabase)
 *  comparten exactamente las mismas reglas. */

const EMPTY = []

/** Ids de las mesas que atiende un mesero. */
export function mesasDeMesero(asignaciones, meseroId) {
  if (!meseroId) return EMPTY
  return (asignaciones ?? []).filter((a) => a.meseroId === meseroId).map((a) => a.mesaId)
}

/** Ids de los meseros que atienden una mesa — puede ser más de uno. */
export function meserosDeMesa(asignaciones, mesaId) {
  if (!mesaId) return EMPTY
  return (asignaciones ?? []).filter((a) => a.mesaId === mesaId).map((a) => a.meseroId)
}

/** ¿Este mesero atiende esta mesa? */
export function atiende(asignaciones, mesaId, meseroId) {
  if (!mesaId || !meseroId) return false
  return (asignaciones ?? []).some((a) => a.mesaId === mesaId && a.meseroId === meseroId)
}

/** Suma un mesero a una mesa. Idempotente: si ya la atendía, devuelve la misma
 *  referencia (importante para los selectores de zustand, que comparan por identidad). */
export function conMesero(asignaciones, mesaId, meseroId) {
  const lista = asignaciones ?? EMPTY
  if (!mesaId || !meseroId || atiende(lista, mesaId, meseroId)) return lista
  return [...lista, { mesaId, meseroId }]
}

/** Quita a un mesero de una mesa, dejando intactos a los demás meseros de esa mesa. */
export function sinMesero(asignaciones, mesaId, meseroId) {
  return (asignaciones ?? []).filter((a) => !(a.mesaId === mesaId && a.meseroId === meseroId))
}

/** Suelta una mesa por completo: deja de estar atendida por nadie. Se usa al borrarla. */
export function sinMesa(asignaciones, mesaId) {
  return (asignaciones ?? []).filter((a) => a.mesaId !== mesaId)
}

/** Suelta a un mesero por completo: deja de atender cualquier mesa. Se usa al darlo de baja. */
export function sinMeseroEnTodas(asignaciones, meseroId) {
  return (asignaciones ?? []).filter((a) => a.meseroId !== meseroId)
}

/** Deja las mesas de un mesero EXACTAMENTE en `mesaIds`. Solo toca las suyas: las
 *  asignaciones de otros meseros sobre esas mismas mesas sobreviven, que es justo lo
 *  que permite que una mesa tenga varios. Espejo de la RPC `pos_set_mesas_mesero`. */
export function fijarMesasDeMesero(asignaciones, meseroId, mesaIds) {
  const deseadas = new Set(mesaIds ?? [])
  const otros = (asignaciones ?? []).filter((a) => a.meseroId !== meseroId)
  return [...otros, ...[...deseadas].map((mesaId) => ({ mesaId, meseroId }))]
}
