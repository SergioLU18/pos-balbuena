import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { uid } from '../lib/utils'
import { usePosStore } from '../store/appStore'

/** Alta, edición y baja de meseros desde el panel de admin. Un mesero puede ser
 *  administrador (esAdmin) — puede editar a los demás y el menú. Sigue el mismo
 *  patrón que useMesaAdmin: en modo mock muta el store; en backend escribe directo
 *  a la tabla `meseros` (RLS abierta, igual que pedidos). El store no se toca en
 *  backend: usePosData recarga por Realtime tras cada cambio. */
export function useMeseroAdmin() {
  const meseros = usePosStore((s) => s.meseros)
  const setMeseros = usePosStore((s) => s.setMeseros)
  const restauranteId = usePosStore((s) => s.restauranteId)

  // m: { id?, nombre, mesas: string[], pin, esAdmin, activo }
  function guardarMesero(m) {
    if (IS_MOCK) {
      if (m.id && meseros.some((x) => x.id === m.id)) {
        setMeseros(meseros.map((x) => (x.id === m.id ? { ...x, ...m } : x)))
      } else {
        setMeseros([...meseros, { id: uid('mesero'), activo: true, ...m }])
      }
      return Promise.resolve({ error: null })
    }
    const row = {
      nombre: m.nombre?.trim(),
      mesas: m.mesas ?? [],
      pin: m.pin || null,
      es_admin: !!m.esAdmin,
      activo: m.activo !== false,
      restaurante_id: restauranteId,
    }
    const q = m.id ? sb.from('meseros').update(row).eq('id', m.id) : sb.from('meseros').insert(row)
    return q.then(({ error }) => ({ error: error?.message ?? null }))
  }

  // Baja lógica: cargarTodo solo trae activo=true, así el mesero desaparece del
  // catálogo sin perder la referencia en pedidos históricos (mesero_nombre queda
  // denormalizado en cada pedido).
  function borrarMesero(id) {
    if (IS_MOCK) {
      setMeseros(meseros.filter((x) => x.id !== id))
      return Promise.resolve({ error: null })
    }
    return sb.from('meseros').update({ activo: false }).eq('id', id).then(({ error }) => ({ error: error?.message ?? null }))
  }

  return { guardarMesero, borrarMesero }
}
