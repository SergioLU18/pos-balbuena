import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { firma } from '../lib/bitacora'
import { sonarConfirmacion, sonarError } from '../lib/sonidos'
import { puedeSerPrincipal, puedeUnirse } from '../lib/mesasUnidas'
import { usePosStore, useOrderStore, usePedidosStore, useAvisosStore } from '../store/appStore'

/** Unir y separar mesas desde el piso. Lo hace cualquier mesero, no solo el admin: pasa
 *  a media operación, cuando llega un grupo grande y el personal junta las mesas.
 *
 *  Unir pasa TODO a la principal — la cuenta abierta de cada secundaria, sus comandas de
 *  cocina y el draft sin enviar de esta tablet —, y de ahí en adelante tocar una
 *  secundaria lleva a la principal. Separar solo suelta la mesa: lo ya pedido se queda en
 *  la cuenta de la principal, porque no hay forma de saber qué renglón era de quién.
 *
 *  Ninguna de las dos se deshace sola al cerrar la cuenta: puede que el grupo se vaya y
 *  las mesas se queden juntas para el siguiente.
 *
 *  Devuelven { error } igual que useMesaAdmin; el aviso de error lo deja aquí mismo en la
 *  campana, como el resto de la operación del mesero. */
export function useMesasUnidas() {
  const avisarError = (titulo, detalle) => {
    sonarError()
    useAvisosStore.getState().agregarAviso({ tipo: 'error', titulo, detalle })
    return { error: detalle }
  }

  function unirMesas(principalId, secundariaIds) {
    const { mesas, setMesas } = usePosStore.getState()
    const principal = mesas.find((m) => m.id === principalId)
    const ids = [...new Set(secundariaIds ?? [])]
    if (!principal || ids.length === 0) return Promise.resolve({ error: 'Elige las mesas que se van a unir.' })

    if (IS_MOCK) {
      const invalida = !puedeSerPrincipal(principal) ||
        ids.some((id) => {
          const m = mesas.find((x) => x.id === id)
          return !m || !puedeUnirse(mesas, m, principalId)
        })
      if (invalida) return Promise.resolve(avisarError('No se unieron las mesas', 'Alguna de las mesas ya está unida a otra'))

      setMesas(mesas.map((m) => (ids.includes(m.id) ? { ...m, joined_to: principalId } : m)))
      useOrderStore.getState().juntarEnMesa(ids, principalId, { moverCuentas: true })
      const { pedidos, setPedidos } = usePedidosStore.getState()
      setPedidos(pedidos.map((p) => (ids.includes(p.mesaId) ? { ...p, mesaId: principalId } : p)))
      sonarConfirmacion()
      return Promise.resolve({ error: null })
    }

    return sb
      .rpc('pos_unir_mesas', { p_principal_id: principalId, p_secundarias: ids, ...firma() })
      .then(({ error }) => {
        if (error) {
          console.error('[mesas] unirMesas falló:', error)
          return avisarError(`Mesa ${principal.numero} · no se unieron las mesas`, error.message)
        }
        useOrderStore.getState().juntarEnMesa(ids, principalId)
        sonarConfirmacion()
        return { error: null }
      })
  }

  function separarMesa(secundariaId) {
    const { mesas, setMesas } = usePosStore.getState()
    const mesa = mesas.find((m) => m.id === secundariaId)
    if (!mesa?.joined_to) return Promise.resolve({ error: null })

    if (IS_MOCK) {
      setMesas(mesas.map((m) => (m.id === secundariaId ? { ...m, joined_to: null } : m)))
      return Promise.resolve({ error: null })
    }

    return sb
      .rpc('pos_separar_mesa', { p_mesa_id: secundariaId, ...firma() })
      .then(({ error }) => {
        if (error) {
          console.error('[mesas] separarMesa falló:', error)
          return avisarError(`Mesa ${mesa.numero} · no se separó`, error.message)
        }
        return { error: null }
      })
  }

  return { unirMesas, separarMesa }
}
