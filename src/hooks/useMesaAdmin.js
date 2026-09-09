import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { uid } from '../lib/utils'
import { usePosStore, useOrderStore, usePedidosStore } from '../store/appStore'

const PREFIJO_PL = /^pl-/i

/** Valida un nombre de mesa: no vacío, ≤ 24 caracteres, sin el prefijo reservado
 *  "PL-" (pedidos para llevar) y único entre las mesas activas del restaurante
 *  (sin distinguir mayúsculas). Devuelve el mensaje de error, o null si es válido.
 *  `exceptoId` deja fuera de la comprobación de duplicados a la mesa que se edita. */
export function validarNombreMesa(nombre, mesas, exceptoId = null) {
  const n = (nombre ?? '').trim()
  if (!n) return 'Escribe un nombre para la mesa.'
  if (n.length > 24) return 'El nombre es demasiado largo (máx. 24 caracteres).'
  if (PREFIJO_PL.test(n)) return 'El prefijo "PL-" está reservado para pedidos para llevar.'
  const dup = mesas.some(
    (m) => m.id !== exceptoId && m.activo !== false && (m.numero ?? '').toLowerCase() === n.toLowerCase(),
  )
  if (dup) return `Ya existe una mesa llamada "${n}".`
  return null
}

/** Alta, renombrado y baja de mesas desde el mapa del piso (modo "Mover mesas").
 *  Solo un mesero administrador ve estos controles (ver MeseroFloorPage). El nombre
 *  de una mesa acepta letras y números y debe ser único. Una mesa con cuenta abierta
 *  no se puede borrar — hacerlo a medio servicio dejaría la cuenta y los pedidos de
 *  cocina huérfanos; en modo backend esa regla la aplica también la RPC. */
export function useMesaAdmin() {
  const mesas = usePosStore((s) => s.mesas)
  const meseros = usePosStore((s) => s.meseros)
  const setMesas = usePosStore((s) => s.setMesas)
  const setMeseros = usePosStore((s) => s.setMeseros)
  const restauranteId = usePosStore((s) => s.restauranteId)

  function crearMesa(numero, meseroId) {
    const nombre = (numero ?? '').trim()
    const err = validarNombreMesa(nombre, mesas)
    if (err) return Promise.resolve({ error: err, id: null })

    if (IS_MOCK) {
      const id = uid('mesa')
      setMesas([...mesas, { id, numero: nombre, activo: true }])
      if (meseroId) {
        setMeseros(meseros.map((m) => (m.id === meseroId ? { ...m, mesas: [...m.mesas, nombre] } : m)))
      }
      return Promise.resolve({ error: null, id })
    }
    return sb
      .rpc('pos_crear_mesa', { p_restaurante_id: restauranteId, p_numero: nombre, p_mesero_id: meseroId ?? null })
      .then(({ data, error }) => ({ error: error?.message ?? null, id: data ?? null }))
  }

  function renombrarMesa(mesaId, nuevoNombre) {
    const nombre = (nuevoNombre ?? '').trim()
    const err = validarNombreMesa(nombre, mesas, mesaId)
    if (err) return Promise.resolve({ error: err })

    if (IS_MOCK) {
      const mesa = mesas.find((m) => m.id === mesaId)
      if (!mesa) return Promise.resolve({ error: 'La mesa ya no existe.' })
      const viejo = mesa.numero
      if (viejo === nombre) return Promise.resolve({ error: null })

      setMesas(mesas.map((m) => (m.id === mesaId ? { ...m, numero: nombre } : m)))
      // meseros.mesas y pedidos.mesaNumero guardan el NOMBRE, no el id: se propaga.
      setMeseros(meseros.map((m) => ({ ...m, mesas: m.mesas.map((n) => (n === viejo ? nombre : n)) })))
      const pedidos = usePedidosStore.getState().pedidos
      usePedidosStore.getState().setPedidos(
        pedidos.map((p) => (p.mesaId === mesaId ? { ...p, mesaNumero: nombre } : p)),
      )
      return Promise.resolve({ error: null })
    }
    return sb
      .rpc('pos_renombrar_mesa', { p_mesa_id: mesaId, p_numero: nombre })
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
      const mesa = mesas.find((m) => m.id === mesaId)
      setMesas(mesas.filter((m) => m.id !== mesaId))
      setMeseros(meseros.map((m) => ({ ...m, mesas: m.mesas.filter((n) => n !== mesa?.numero) })))
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_borrar_mesa', { p_mesa_id: mesaId }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  return { crearMesa, renombrarMesa, borrarMesa }
}
