import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { uid } from '../lib/utils'
import { usePosStore, useOrderStore } from '../store/appStore'

/** Alta y baja de mesas desde el mapa del piso (modo "Mover mesas"). Una mesa con
 *  cuenta abierta no se puede borrar — hacerlo a medio servicio dejaría la cuenta
 *  y los pedidos de cocina huérfanos. En modo backend esa regla la aplica también
 *  la RPC `pos_borrar_mesa`, así que queda protegida aunque dos meseros la
 *  intenten borrar al mismo tiempo desde tablets distintas. */
export function useMesaAdmin() {
  const mesas = usePosStore((s) => s.mesas)
  const meseros = usePosStore((s) => s.meseros)
  const setMesas = usePosStore((s) => s.setMesas)
  const setMeseros = usePosStore((s) => s.setMeseros)
  const restauranteId = usePosStore((s) => s.restauranteId)
  const cuentas = useOrderStore((s) => s.cuentas)

  function crearMesa(numero, meseroId) {
    if (IS_MOCK) {
      setMesas([...mesas, { id: uid('mesa'), numero, activo: true }])
      if (meseroId) {
        setMeseros(meseros.map((m) => (m.id === meseroId ? { ...m, mesas: [...m.mesas, numero] } : m)))
      }
      return Promise.resolve({ error: null })
    }
    return sb
      .rpc('pos_crear_mesa', { p_restaurante_id: restauranteId, p_numero: numero, p_mesero_id: meseroId ?? null })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  function borrarMesa(mesaId) {
    if (IS_MOCK) {
      if (cuentas[mesaId]) {
        return Promise.resolve({ error: 'No se puede borrar una mesa con cuenta abierta.' })
      }
      const mesa = mesas.find((m) => m.id === mesaId)
      setMesas(mesas.filter((m) => m.id !== mesaId))
      setMeseros(meseros.map((m) => ({ ...m, mesas: m.mesas.filter((n) => n !== mesa?.numero) })))
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_borrar_mesa', { p_mesa_id: mesaId }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  return { crearMesa, borrarMesa }
}
