import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { uid } from '../lib/utils'
import { firmaActor } from '../lib/bitacora'
import { usePosStore } from '../store/appStore'

/** Alta, edición y baja de meseros desde el panel de admin. Un mesero puede ser
 *  administrador (esAdmin) — puede editar a los demás y el menú. Sigue el mismo
 *  patrón que useMesaAdmin: en modo mock muta el store; en backend pasa por RPCs
 *  (pos_guardar_mesero y compañía) para que cada cambio quede en la bitácora. El
 *  store no se toca en backend: usePosData recarga por Realtime tras cada cambio.
 *
 *  No hay reparto de mesas: cualquier mesero atiende cualquier mesa. */
export function useMeseroAdmin() {
  const meseros = usePosStore((s) => s.meseros)
  const setMeseros = usePosStore((s) => s.setMeseros)
  const restauranteId = usePosStore((s) => s.restauranteId)

  // m: { id?, nombre, pin, esAdmin, activo }
  function guardarMesero(m) {
    if (IS_MOCK) {
      const existente = m.id && meseros.some((x) => x.id === m.id)
      const id = existente ? m.id : uid('mesero')
      setMeseros(
        existente
          ? meseros.map((x) => (x.id === id ? { ...x, ...m } : x))
          : [...meseros, { activo: true, ...m, id }],
      )
      return Promise.resolve({ error: null })
    }
    return sb
      .rpc('pos_guardar_mesero', {
        p_id: m.id ?? null,
        p_restaurante_id: restauranteId,
        p_nombre: m.nombre?.trim(),
        p_pin: m.pin || null,
        p_es_admin: !!m.esAdmin,
        p_activo: m.activo !== false,
        ...firmaActor(),
      })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  // Baja lógica: cargarTodo solo trae activo=true, así el mesero desaparece del
  // catálogo sin perder la referencia en pedidos históricos (mesero_nombre queda
  // denormalizado en cada pedido).
  function borrarMesero(id) {
    if (IS_MOCK) {
      setMeseros(meseros.filter((x) => x.id !== id))
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_borrar_mesero', { p_mesero_id: id, ...firmaActor() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  return { guardarMesero, borrarMesero }
}
