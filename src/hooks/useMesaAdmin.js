import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { uid } from '../lib/utils'
import { usePosStore, useOrderStore } from '../store/appStore'

/** Alta y baja de mesas desde el mapa del piso (modo "Mover mesas"). Una mesa con
 *  cuenta abierta no se puede borrar — hacerlo a medio servicio dejaría la cuenta
 *  y los pedidos de cocina huérfanos. En modo backend esa regla la aplica también
 *  la RPC `pos_borrar_mesa`, así que queda protegida aunque dos meseros la
 *  intenten borrar al mismo tiempo desde tablets distintas.
 *
 *  `crearMesa` recibe VARIOS meseros porque una mesa se puede repartir entre más de
 *  uno desde que se crea (ver src/lib/asignaciones.js). */
export function useMesaAdmin() {
  const mesas = usePosStore((s) => s.mesas)
  const setMesas = usePosStore((s) => s.setMesas)
  const atenderMesa = usePosStore((s) => s.atenderMesa)
  const soltarMesa = usePosStore((s) => s.soltarMesa)
  const restauranteId = usePosStore((s) => s.restauranteId)
  const cuentas = useOrderStore((s) => s.cuentas)

  function crearMesa(numero, meseroIds = []) {
    const ids = (meseroIds ?? []).filter(Boolean)
    if (IS_MOCK) {
      const mesa = { id: uid('mesa'), numero, activo: true }
      setMesas([...mesas, mesa])
      for (const meseroId of ids) atenderMesa(mesa.id, meseroId)
      return Promise.resolve({ error: null })
    }
    return sb
      .rpc('pos_crear_mesa', { p_restaurante_id: restauranteId, p_numero: numero, p_mesero_ids: ids })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  function borrarMesa(mesaId) {
    if (IS_MOCK) {
      if (cuentas[mesaId]) {
        return Promise.resolve({ error: 'No se puede borrar una mesa con cuenta abierta.' })
      }
      setMesas(mesas.filter((m) => m.id !== mesaId))
      soltarMesa(mesaId) // deja de estar atendida por nadie
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_borrar_mesa', { p_mesa_id: mesaId }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  return { crearMesa, borrarMesa }
}
