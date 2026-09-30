import { sb } from '../lib/supabase'
import { firma } from '../lib/bitacora'
import { usePosStore } from '../store/appStore'

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
 *  de cocina huérfanos; esa regla la aplica la RPC `pos_borrar_mesa`, así que queda protegida aunque dos meseros la intenten borrar al
 *  mismo tiempo desde tablets distintas. */
export function useMesaAdmin() {
  const mesas = usePosStore((s) => s.mesas)
  const restauranteId = usePosStore((s) => s.restauranteId)

  function crearMesa(numero) {
    const nombre = (numero ?? '').trim()
    const err = validarNombreMesa(nombre, mesas)
    if (err) return Promise.resolve({ error: err, id: null })

    return sb
      .rpc('pos_crear_mesa', { p_restaurante_id: restauranteId, p_numero: nombre, ...firma() })
      .then(({ data, error }) => ({ error: error?.message ?? null, id: data ?? null }))
  }

  function renombrarMesa(mesaId, nuevoNombre) {
    const nombre = (nuevoNombre ?? '').trim()
    const err = validarNombreMesa(nombre, mesas, mesaId)
    if (err) return Promise.resolve({ error: err })

    return sb
      .rpc('pos_renombrar_mesa', { p_mesa_id: mesaId, p_numero: nombre, ...firma() })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  /** Reordena el listado compartido de mesas. Recibe los ids en el orden deseado
   *  (los que muestra Ajustes → Mesas). Solo el admin llega aquí. */
  function reordenarMesas(idsEnOrden) {
    return sb
      .rpc('pos_reordenar_mesas', { p_ids: idsEnOrden, ...firma() })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  function borrarMesa(mesaId) {
    return sb.rpc('pos_borrar_mesa', { p_mesa_id: mesaId, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  return { crearMesa, renombrarMesa, reordenarMesas, borrarMesa }
}
