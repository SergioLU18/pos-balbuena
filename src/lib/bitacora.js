import { useMeseroStore, usePosStore } from '../store/appStore'

/** Quién firma la acción que se está mandando al backend.
 *
 *  Todas las RPCs `pos_*` aceptan al actor como par de parámetros para poder dejarlo
 *  en la bitácora (ver supabase/bitacora.sql). Sale del store y no de un argumento
 *  porque es SIEMPRE el mismo dato — el mesero activo en esta tablet — y hacerlo viajar
 *  a mano por cada llamada era la forma segura de que tarde o temprano se olvidara en
 *  alguna y esa acción quedara sin dueño.
 *
 *  Se lee con getState() y no con el hook: esto se llama desde dentro de handlers y
 *  callbacks, no durante el render, y no debe suscribir a nada.
 *
 *  Ojo: esto es lo que hace que el actor sea AUTODECLARADO. No hay auth; la firma vale
 *  lo que vale el PIN que abrió la sesión en esta tablet. */
function actorActual() {
  const { currentMeseroId } = useMeseroStore.getState()
  const mesero = usePosStore.getState().meseros.find((m) => m.id === currentMeseroId)
  return { id: mesero?.id ?? null, nombre: mesero?.nombre ?? null }
}

/** Firma para las RPCs donde el mesero ES el actor: `{ p_mesero_id, p_mesero_nombre }`.
 *  Se usa esparcida dentro del objeto de parámetros:
 *    sb.rpc('pos_cerrar_mesa', { p_mesa_id: id, ...firma() }) */
export function firma() {
  const { id, nombre } = actorActual()
  return { p_mesero_id: id, p_mesero_nombre: nombre }
}

/** Firma para las dos RPCs donde `p_mesero_*` ya estaba tomado por el mesero AFECTADO
 *  (pos_set_mesas_mesero y pos_borrar_mesero): ahí el actor entra como `p_actor_*`. */
export function firmaActor() {
  const { id, nombre } = actorActual()
  return { p_actor_id: id, p_actor_nombre: nombre }
}
