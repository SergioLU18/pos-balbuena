import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { uid } from '../lib/utils'
import { firma } from '../lib/bitacora'
import { usePosStore, useOrderStore, usePedidosStore } from '../store/appStore'

/** Valida un nombre de mesa: no vacío, ≤ 24 caracteres y único entre las mesas activas
 *  del restaurante (sin distinguir mayúsculas). Devuelve el mensaje de error, o null si
 *  es válido. `exceptoId` deja fuera de la comprobación de duplicados a la mesa que se
 *  edita. */
export function validarNombreMesa(nombre, mesas, exceptoId = null) {
  const n = (nombre ?? '').trim()
  if (!n) return 'Escribe un nombre para la mesa.'
  if (n.length > 24) return 'El nombre es demasiado largo (máx. 24 caracteres).'
  const dup = mesas.some(
    (m) => m.id !== exceptoId && m.activo !== false && (m.numero ?? '').toLowerCase() === n.toLowerCase(),
  )
  if (dup) return `Ya existe una mesa llamada "${n}".`
  return null
}

/** Alta, renombrado, reordenamiento y baja de mesas (Ajustes → Mesas; solo el admin
 *  llega ahí). El nombre acepta letras y números y debe ser único. Una mesa con cuenta
 *  abierta no se puede borrar — hacerlo a medio servicio dejaría la cuenta y los pedidos
 *  de cocina huérfanos; en modo backend esa regla la aplica también la RPC
 *  `pos_borrar_mesa`, así que queda protegida aunque dos meseros la intenten borrar al
 *  mismo tiempo desde tablets distintas.
 *
 *  `crearMesa` recibe VARIOS meseros porque una mesa se puede repartir entre más de
 *  uno desde que se crea (ver src/lib/asignaciones.js). */
export function useMesaAdmin() {
  const mesas = usePosStore((s) => s.mesas)
  const setMesas = usePosStore((s) => s.setMesas)
  const atenderMesa = usePosStore((s) => s.atenderMesa)
  const soltarMesa = usePosStore((s) => s.soltarMesa)
  const restauranteId = usePosStore((s) => s.restauranteId)

  function crearMesa(numero, meseroIds = []) {
    const nombre = (numero ?? '').trim()
    const err = validarNombreMesa(nombre, mesas)
    if (err) return Promise.resolve({ error: err, id: null })
    const ids = (meseroIds ?? []).filter(Boolean)

    if (IS_MOCK) {
      const mesa = { id: uid('mesa'), numero: nombre, activo: true }
      setMesas([...mesas, mesa])
      for (const meseroId of ids) atenderMesa(mesa.id, meseroId)
      return Promise.resolve({ error: null, id: mesa.id })
    }
    return sb
      .rpc('pos_crear_mesa', { p_restaurante_id: restauranteId, p_numero: nombre, p_mesero_ids: ids, ...firma() })
      .then(({ data, error }) => ({ error: error?.message ?? null, id: data ?? null }))
  }

  function renombrarMesa(mesaId, nuevoNombre) {
    const nombre = (nuevoNombre ?? '').trim()
    const err = validarNombreMesa(nombre, mesas, mesaId)
    if (err) return Promise.resolve({ error: err })

    if (IS_MOCK) {
      const mesa = mesas.find((m) => m.id === mesaId)
      if (!mesa) return Promise.resolve({ error: 'La mesa ya no existe.' })
      if (mesa.numero === nombre) return Promise.resolve({ error: null })

      setMesas(mesas.map((m) => (m.id === mesaId ? { ...m, numero: nombre } : m)))
      // Quién atiende la mesa NO hay que tocarlo: `asignaciones` guarda ids, no nombres
      // — justo para que renombrar una mesa no reasigne nada por accidente. Lo que sí
      // guarda el NOMBRE es la copia denormalizada de la comanda (pedidos.mesaNumero),
      // así que esa sí se propaga o la cocina seguiría cantando el nombre viejo.
      const { pedidos, setPedidos } = usePedidosStore.getState()
      setPedidos(pedidos.map((p) => (p.mesaId === mesaId ? { ...p, mesaNumero: nombre } : p)))
      return Promise.resolve({ error: null })
    }
    return sb
      .rpc('pos_renombrar_mesa', { p_mesa_id: mesaId, p_numero: nombre, ...firma() })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  /** Reordena el listado compartido de mesas. Recibe los ids en el orden deseado
   *  (los que muestra Ajustes → Mesas). Solo el admin llega aquí. */
  function reordenarMesas(idsEnOrden) {
    if (IS_MOCK) {
      const porId = new Map(mesas.map((m) => [m.id, m]))
      const nuevas = [
        ...idsEnOrden.map((id) => porId.get(id)).filter(Boolean),
        ...mesas.filter((m) => !idsEnOrden.includes(m.id)),
      ]
      setMesas(nuevas)
      return Promise.resolve({ error: null })
    }
    return sb
      .rpc('pos_reordenar_mesas', { p_ids: idsEnOrden, ...firma() })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  function borrarMesa(mesaId) {
    if (IS_MOCK) {
      // Lee el estado fresco (no la suscripción reactiva de este render) porque a veces
      // se llama justo después de cerrarMesa(), en el mismo tick, antes de que React
      // vuelva a renderizar este hook con el `cuentas` ya actualizado.
      if (useOrderStore.getState().cuentas[mesaId]) {
        return Promise.resolve({ error: 'No se puede borrar una mesa con cuenta abierta.' })
      }
      if (mesas.some((m) => (m.id === mesaId && m.joined_to) || m.joined_to === mesaId)) {
        return Promise.resolve({ error: 'La mesa está unida con otra. Sepárala antes de borrarla.' })
      }
      setMesas(mesas.filter((m) => m.id !== mesaId))
      soltarMesa(mesaId) // deja de estar atendida por nadie
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_borrar_mesa', { p_mesa_id: mesaId, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  return { crearMesa, renombrarMesa, reordenarMesas, borrarMesa }
}
