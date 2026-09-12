import { uid } from '../lib/utils'
import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { firma } from '../lib/bitacora'
import { sonarConfirmacion, sonarError } from '../lib/sonidos'
import {
  useAvisosStore, useLlevarStore, useMeseroStore, useOrderStore, usePedidosStore, usePosStore,
} from '../store/appStore'
import { calcItemPrecio, calcSubtotal, nombreItem, sumaCuenta } from './useOrderDraft'
import { cargarTodo } from './usePosData'

// Referencia estable para el fallback del selector (ver la nota en useOrderDraft: un
// array literal nuevo en cada llamada mete a useSyncExternalStore en un loop).
const EMPTY_ITEMS = []

/** Toma de orden de una orden PARA LLEVAR. Es el gemelo de useOrderDraft cuando no hay
 *  mesa: mismo draft, mismo "enviar a cocina", mismos controles sobre un renglón ya
 *  enviado — lo que cambia es a qué se cuelga el pedido (una orden de mostrador en vez
 *  de una mesa) y que no hay cuenta de tali detrás.
 *
 *  El draft se guarda en useOrderStore con el id de la ORDEN como llave, junto a los de
 *  las mesas: son uuids, no se pisan, y así el mesero puede tener a medias una orden de
 *  mostrador y varias mesas al mismo tiempo, cada una con lo suyo.
 *
 *  El ticket de una orden abierta se arma de sus pedidos (ahí viven los renglones ya
 *  enviados, con su precio), no de `cuenta_items`: una orden para llevar se cobra en
 *  caja y no pasa por el flujo de dividir y pagar de tali. */
export function useOrdenLlevar(ordenId) {
  const draft = useOrderStore((s) => s.drafts[ordenId] ?? EMPTY_ITEMS)
  const addDraftItem = useOrderStore((s) => s.addDraftItem)
  const updateDraftItem = useOrderStore((s) => s.updateDraftItem)
  const removeDraftItem = useOrderStore((s) => s.removeDraftItem)
  const clearDraft = useOrderStore((s) => s.clearDraft)
  const orden = useLlevarStore((s) => s.ordenes).find((o) => o.id === ordenId) ?? null
  const actualizarOrdenLocal = useLlevarStore((s) => s.actualizarOrdenLocal)
  const quitarOrdenLocal = useLlevarStore((s) => s.quitarOrdenLocal)
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const meseros = usePosStore((s) => s.meseros)
  const agregarPedido = usePedidosStore((s) => s.agregarPedido)
  const actualizarCantidadItemPedido = usePedidosStore((s) => s.actualizarCantidadItemPedido)
  const quitarItemPedido = usePedidosStore((s) => s.quitarItemPedido)
  const eliminarPedidosDeOrdenLlevar = usePedidosStore((s) => s.eliminarPedidosDeOrdenLlevar)
  const pedidos = usePedidosStore((s) => s.pedidos).filter((p) => p.ordenLlevarId === ordenId)

  const etiqueta = orden ? `Para llevar L-${orden.folio}` : 'Para llevar'
  const avisarError = (titulo, detalle) => {
    sonarError()
    useAvisosStore.getState().agregarAviso({
      tipo: 'error',
      titulo: `${etiqueta} · ${titulo}`,
      detalle,
      ruta: `/mesero/llevar/orden/${ordenId}`,
    })
  }

  // Los renglones ya enviados de la orden: todos los de sus comandas, aplanados. El
  // ticket los pinta igual que los de una cuenta de mesa (ver OrderTicket).
  const enviados = pedidos.flatMap((p) => p.items ?? [])

  function agregarItemConstruido(item) {
    addDraftItem(ordenId, item)
  }

  function cambiarCantidad(itemId, delta) {
    const item = draft.find((i) => i.id === itemId)
    if (!item) return
    updateDraftItem(ordenId, itemId, { cantidad: Math.max(1, item.cantidad + delta) })
  }

  function quitarItem(itemId) {
    removeDraftItem(ordenId, itemId)
  }

  function enviarACocina() {
    if (draft.length === 0) return
    const mesero = meseros.find((m) => m.id === currentMeseroId)
    // Cada renglón lleva nombre + precio_unitario además de su estructura rica: es lo que
    // permite que el total de la orden (y su copia congelada al cerrarla) se calcule sin
    // depender del catálogo vivo, igual que en las cuentas de mesa.
    const payload = draft.map((it) => ({
      ...it,
      nombre: nombreItem(it),
      precio_unitario: calcItemPrecio(it),
    }))

    if (!IS_MOCK) {
      sb.rpc('pos_enviar_orden_llevar', {
        p_orden_id: ordenId,
        p_items: payload,
        p_mesero_id: mesero?.id ?? null,
        p_mesero_nombre: mesero?.nombre ?? '—',
      }).then(({ error }) => {
        if (error) {
          console.error('[llevar] enviarACocina falló:', error)
          avisarError('no se envió la orden', 'Sigue en pantalla sin enviar — revisa la conexión e inténtalo otra vez')
        } else {
          clearDraft(ordenId)
          sonarConfirmacion()
        }
      })
      return
    }

    agregarPedido({
      id: uid('pedido'),
      tipo: 'llevar',
      mesaId: null,
      mesaNumero: null,
      ordenLlevarId: ordenId,
      clienteNombre: orden?.clienteNombre ?? null,
      meseroId: mesero?.id ?? null,
      meseroNombre: mesero?.nombre ?? '—',
      items: payload,
      enviadoAt: new Date().toISOString(),
      estado: 'pendiente',
    })
    clearDraft(ordenId)
    sonarConfirmacion()
  }

  const recargarDesdeBackend = () => cargarTodo(usePosStore.getState().restauranteId).catch(() => {})

  /** Fija la cantidad ABSOLUTA de un renglón ya enviado. Solo surte efecto mientras su
   *  comanda sigue en 'pendiente' (cocina no la ha empezado) — lo valida el mismo RPC que
   *  usan las mesas, del lado del servidor. */
  function fijarCantidadEnviado(pedidoId, itemId, cantidad) {
    const pedido = pedidos.find((p) => p.id === pedidoId)
    const item = pedido?.items.find((it) => it.id === itemId)
    if (!item) return
    const nueva = Math.max(1, cantidad)
    if (nueva === item.cantidad) return

    // Optimista, igual que en las mesas: el ticket refleja el cambio en el acto y el RPC
    // lo confirma. A diferencia de las mesas aquí no hay cuenta_items que ajustar — el
    // renglón del pedido ES el del ticket.
    actualizarCantidadItemPedido(pedidoId, itemId, nueva)
    if (IS_MOCK) return

    sb.rpc('pos_editar_item_pedido', { p_pedido_id: pedidoId, p_item_id: itemId, p_cantidad: nueva, ...firma() })
      .then(({ error }) => {
        if (error) {
          console.error('[llevar] fijarCantidadEnviado falló:', error)
          avisarError('no se pudo cambiar la cantidad', 'El pedido se dejó como estaba')
          recargarDesdeBackend()
        }
      })
  }

  function quitarItemEnviado(pedidoId, itemId) {
    quitarItemPedido(pedidoId, itemId)
    if (IS_MOCK) return

    sb.rpc('pos_eliminar_item_pedido', { p_pedido_id: pedidoId, p_item_id: itemId, ...firma() })
      .then(({ error }) => {
        if (error) {
          console.error('[llevar] quitarItemEnviado falló:', error)
          avisarError('no se pudo quitar el platillo', 'Sigue en la comanda de cocina')
          recargarDesdeBackend()
        }
      })
  }

  /** Cierra la orden: 'entregada' cuando el cliente ya se la llevó, 'cancelada' si no la
   *  recogió. En los dos casos el total y los renglones quedan congelados en la fila —
   *  es de ahí que sale el historial de compras del cliente — y sus comandas salen del
   *  tablero de cocina, igual que al cerrar una mesa. */
  function cerrarOrden(estado = 'entregada') {
    if (IS_MOCK) {
      actualizarOrdenLocal(ordenId, {
        estado,
        total: sumaCuenta(enviados),
        items: enviados,
        closedAt: new Date().toISOString(),
      })
      eliminarPedidosDeOrdenLlevar(ordenId)
      clearDraft(ordenId)
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_cerrar_orden_llevar', { p_orden_id: ordenId, p_estado: estado, ...firma() })
      .then(({ error }) => {
        if (error) {
          console.error('[llevar] cerrarOrden falló:', error)
          avisarError('no se pudo cerrar la orden', 'La orden sigue abierta')
          return { error: error.message }
        }
        clearDraft(ordenId)
        return { error: null }
      })
  }

  /** Descarta una orden que nunca llegó a cocina (sin renglones enviados): se BORRA en
   *  vez de cancelarse, para no dejar una "cancelada de $0" en el historial del cliente
   *  por algo que no existió. Optimista: la orden sale del listado en el acto; si el RPC
   *  falla (p. ej. otra tablet le mandó platillos mientras tanto) se recarga y vuelve. */
  function descartarOrden() {
    if (enviados.length > 0) return
    quitarOrdenLocal(ordenId)
    eliminarPedidosDeOrdenLlevar(ordenId)
    clearDraft(ordenId)
    if (IS_MOCK) return

    sb.rpc('pos_descartar_orden_llevar', { p_orden_id: ordenId, ...firma() })
      .then(({ error }) => {
        if (error) {
          console.error('[llevar] descartarOrden falló:', error)
          recargarDesdeBackend()
        }
      })
  }

  return {
    orden,
    draft,
    pedidos,
    enviados,
    subtotalDraft: calcSubtotal(draft),
    subtotalEnviado: sumaCuenta(enviados),
    agregarItemConstruido,
    cambiarCantidad,
    quitarItem,
    enviarACocina,
    fijarCantidadEnviado,
    quitarItemEnviado,
    cerrarOrden,
    descartarOrden,
  }
}
