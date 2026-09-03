import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { uid } from '../lib/utils'
import { usePosStore } from '../store/appStore'

/** Alta, edición y baja de meseros desde el panel de admin. Un mesero puede ser
 *  administrador (esAdmin) — puede editar a los demás y el menú. Sigue el mismo
 *  patrón que useMesaAdmin: en modo mock muta el store; en backend escribe directo
 *  a la tabla `meseros` (RLS abierta, igual que pedidos). El store no se toca en
 *  backend: usePosData recarga por Realtime tras cada cambio.
 *
 *  Las mesas que atiende NO son una columna del mesero: viven en `mesa_meseros`,
 *  porque una mesa puede tener varios. Por eso guardar un mesero son dos escrituras
 *  (sus datos + su reparto de mesas) y el reparto se manda entero a una RPC que lo
 *  deja idéntico en una sola transacción, sin tocar a los demás meseros de esas mesas. */
export function useMeseroAdmin() {
  const meseros = usePosStore((s) => s.meseros)
  const setMeseros = usePosStore((s) => s.setMeseros)
  const fijarMesasDeMesero = usePosStore((s) => s.fijarMesasDeMesero)
  const soltarMesero = usePosStore((s) => s.soltarMesero)
  const restauranteId = usePosStore((s) => s.restauranteId)

  // m: { id?, nombre, mesas: string[] (ids de mesa), pin, esAdmin, activo }
  function guardarMesero(m) {
    const { mesas: mesaIds = [], ...campos } = m
    if (IS_MOCK) {
      const existente = m.id && meseros.some((x) => x.id === m.id)
      const id = existente ? m.id : uid('mesero')
      setMeseros(
        existente
          ? meseros.map((x) => (x.id === id ? { ...x, ...campos } : x))
          : [...meseros, { activo: true, ...campos, id }],
      )
      fijarMesasDeMesero(id, mesaIds)
      return Promise.resolve({ error: null })
    }
    const row = {
      nombre: m.nombre?.trim(),
      pin: m.pin || null,
      es_admin: !!m.esAdmin,
      activo: m.activo !== false,
      restaurante_id: restauranteId,
    }
    // En el alta hay que recuperar el id generado para poder asignarle sus mesas:
    // el reparto vive en otra tabla y no puede viajar en el mismo insert.
    const q = m.id
      ? sb.from('meseros').update(row).eq('id', m.id).select('id').single()
      : sb.from('meseros').insert(row).select('id').single()
    return q.then(({ data, error }) => {
      if (error) return { error: error.message }
      return sb
        .rpc('pos_set_mesas_mesero', { p_mesero_id: data.id, p_mesa_ids: mesaIds })
        .then(({ error: errMesas }) => ({ error: errMesas?.message ?? null }))
    })
  }

  // Baja lógica: cargarTodo solo trae activo=true, así el mesero desaparece del
  // catálogo sin perder la referencia en pedidos históricos (mesero_nombre queda
  // denormalizado en cada pedido). La RPC además lo suelta de todas sus mesas —
  // quien ya no está en el turno no puede seguir figurando como quien las atiende.
  function borrarMesero(id) {
    if (IS_MOCK) {
      setMeseros(meseros.filter((x) => x.id !== id))
      soltarMesero(id)
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_borrar_mesero', { p_mesero_id: id }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  return { guardarMesero, borrarMesero }
}
