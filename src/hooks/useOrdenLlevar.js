import { useRef, useState } from 'react'
import { sb } from '../lib/supabase'
import { firma } from '../lib/bitacora'
import { sonarConfirmacion, sonarError } from '../lib/sonidos'
import {
  useAvisosStore, useLlevarStore, useMeseroStore, useOrderStore, usePedidosStore, usePosStore,
} from '../store/appStore'
import { avisarComandaNoImpresa, calcItemPrecio, calcSubtotal, nombreItem, sumaCuenta } from './useOrderDraft'
import { imprimirComanda } from '../lib/impresora'
import { comanda } from '../lib/tickets'
import { cargarTodo } from './usePosData'
import { conEmpaque } from '../lib/empaque'

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
  const quitarOrdenLocal = useLlevarStore((s) => s.quitarOrdenLocal)
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const meseros = usePosStore((s) => s.meseros)
  const actualizarCantidadItemPedido = usePedidosStore((s) => s.actualizarCantidadItemPedido)
  const actualizarItemPedido = usePedidosStore((s) => s.actualizarItemPedido)
  const quitarItemPedido = usePedidosStore((s) => s.quitarItemPedido)
  const eliminarPedidosDeOrdenLlevar = usePedidosStore((s) => s.eliminarPedidosDeOrdenLlevar)
  const pedidos = usePedidosStore((s) => s.pedidos).filter((p) => p.ordenLlevarId === ordenId)
  // Mismo candado que useOrderDraft: sin él, un doble toque en "Enviar" mientras la RPC
  // no contesta mandaba la comanda dos veces a cocina.
  const enviandoRef = useRef(false)
  const [enviando, setEnviando] = useState(false)

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

  // Todo lo que se pide para llevar, bebidas incluidas, entra en desechable (lo normal);
  // el mesero lo cambia a tupper en el ticket, renglón por renglón.
  function agregarItemConstruido(item) {
    addDraftItem(ordenId, conEmpaque(item, 'plastico'))
  }

  function cambiarEmpaque(itemId, empaque) {
    const item = draft.find((i) => i.id === itemId)
    if (!item?.empaque) return
    const { empaque: e, ajusteEmpaque } = conEmpaque(item, empaque)
    updateDraftItem(ordenId, itemId, { empaque: e, ajusteEmpaque })
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
    if (draft.length === 0 || enviandoRef.current) return
    const mesero = meseros.find((m) => m.id === currentMeseroId)
    // Cada renglón lleva nombre + precio_unitario además de su estructura rica: es lo que
    // permite que el total de la orden (y su copia congelada al cerrarla) se calcule sin
    // depender del catálogo vivo, igual que en las cuentas de mesa.
    const payload = draft.map((it) => ({
      ...it,
      nombre: nombreItem(it),
      precio_unitario: calcItemPrecio(it),
    }))
    const comandaBloques = comanda({
      destino: orden?.clienteNombre ? `${etiqueta} · ${orden.clienteNombre}` : etiqueta,
      mesero: mesero?.nombre,
      items: draft,
      llevar: true,
    })

    enviandoRef.current = true
    setEnviando(true)
    sb.rpc('pos_enviar_orden_llevar', {
      p_orden_id: ordenId,
      p_items: payload,
      p_mesero_id: mesero?.id ?? null,
      p_mesero_nombre: mesero?.nombre ?? '—',
    }).then(({ error }) => {
      enviandoRef.current = false
      setEnviando(false)
      if (error) {
        console.error('[llevar] enviarACocina falló:', error)
        avisarError('no se envió la orden', 'Sigue en pantalla sin enviar — revisa la conexión e inténtalo otra vez')
      } else {
        clearDraft(ordenId)
        sonarConfirmacion()
        imprimirComanda(comandaBloques).then((r) => {
          if (r && !r.ok) avisarComandaNoImpresa(etiqueta, r.motivo, { ruta: `/mesero/llevar/orden/${ordenId}` })
        })
      }
    })
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
    sb.rpc('pos_editar_item_pedido', { p_pedido_id: pedidoId, p_item_id: itemId, p_cantidad: nueva, ...firma() })
      .then(({ error }) => {
        if (error) {
          console.error('[llevar] fijarCantidadEnviado falló:', error)
          avisarError('no se pudo cambiar la cantidad', 'El pedido se dejó como estaba')
          recargarDesdeBackend()
        }
      })
  }

  /** Cancela `cantidad` piezas de un renglón ya enviado con la autorización de un admin
   *  (`autorizaId`), en cualquier columna de cocina — igual que en las mesas (ver
   *  cancelarEnviado en useOrderDraft). Todas las piezas = quitar el renglón. */
  function cancelarEnviado(pedidoId, itemId, cantidad, autorizaId) {
    const pedido = pedidos.find((p) => p.id === pedidoId)
    const item = pedido?.items.find((it) => it.id === itemId)
    if (!item || cantidad < 1) return
    if (cantidad >= item.cantidad) { quitarItemEnviado(pedidoId, itemId, autorizaId); return }

    const nueva = item.cantidad - cantidad
    actualizarItemPedido(pedidoId, itemId, { cantidad: nueva })
    sb.rpc('pos_editar_item_pedido', { p_pedido_id: pedidoId, p_item_id: itemId, p_cantidad: nueva, p_autoriza_id: autorizaId, ...firma() })
      .then(({ error }) => {
        if (error) {
          console.error('[llevar] cancelarEnviado falló:', error)
          avisarError('no se pudo cancelar el platillo', 'Sigue en la orden como estaba')
          recargarDesdeBackend()
        }
      })
  }

  function quitarItemEnviado(pedidoId, itemId, autorizaId) {
    quitarItemPedido(pedidoId, itemId)
    sb.rpc('pos_eliminar_item_pedido', { p_pedido_id: pedidoId, p_item_id: itemId, p_autoriza_id: autorizaId, ...firma() })
      .then(({ error }) => {
        if (error) {
          console.error('[llevar] quitarItemEnviado falló:', error)
          avisarError('no se pudo quitar el platillo', 'Sigue en la comanda de cocina')
          recargarDesdeBackend()
        }
      })
  }

  /** Cambia el empaque de un renglón YA enviado (p. ej. el cliente llegó con su tupper
   *  a recoger). A diferencia de la cantidad, se permite en cualquier columna de cocina
   *  mientras la orden no se cobre: no cambia qué se cocina, solo cuánto se cobra. */
  function cambiarEmpaqueEnviado(pedidoId, itemId, empaque) {
    const pedido = pedidos.find((p) => p.id === pedidoId)
    const item = pedido?.items.find((it) => it.id === itemId)
    if (!item?.empaque || item.empaque === empaque) return
    const nuevo = conEmpaque(item, empaque)
    const patch = {
      empaque: nuevo.empaque,
      ajusteEmpaque: nuevo.ajusteEmpaque,
      nombre: nombreItem(nuevo),
      precio_unitario: Number(item.precio_unitario) - Number(item.ajusteEmpaque ?? 0) + nuevo.ajusteEmpaque,
    }
    actualizarItemPedido(pedidoId, itemId, patch)
    sb.rpc('pos_empaque_item_llevar', {
      p_pedido_id: pedidoId,
      p_item_id: itemId,
      p_empaque: patch.empaque,
      p_ajuste: patch.ajusteEmpaque,
      p_nombre: patch.nombre,
      ...firma(),
    }).then(({ error }) => {
      if (error) {
        console.error('[llevar] cambiarEmpaqueEnviado falló:', error)
        avisarError('no se pudo cambiar el empaque', 'El platillo se quedó como estaba')
        recargarDesdeBackend()
      }
    })
  }

  /** Cobra y entrega la orden en un solo paso: de 'abierta' a 'entregada'. Congela
   *  renglones y total, guarda el método de pago, y sus comandas salen del tablero de
   *  cocina — mismo momento que antes hacía "Entregar y cerrar", solo que ahora
   *  registrando con qué se pagó. */
  function pagarOrden(metodoPago, detalle = {}) {
    return sb.rpc('pos_pagar_orden_llevar', {
      p_orden_id: ordenId,
      p_metodo_pago: metodoPago,
      p_monto_efectivo: detalle.efectivo ?? null,
      p_monto_tarjeta: detalle.tarjeta ?? null,
      ...firma(),
    }).then(({ error }) => {
      if (error) {
        console.error('[llevar] pagarOrden falló:', error)
        avisarError('no se pudo cobrar la orden', 'Sigue abierta — revisa la conexión e inténtalo otra vez')
        return { error: error.message }
      }
      clearDraft(ordenId)
      return { error: null }
    })
  }

  /** Cancela la orden. El total y los renglones quedan congelados en la fila — es de
   *  ahí que sale el historial de compras del cliente — y sus comandas salen del
   *  tablero de cocina, igual que al cerrar una mesa. */
  // Una orden que ya mandó comida a cocina solo la cancela un admin (`autorizaId`);
  // la que no mandó nada no llega aquí: se descarta (ver descartarOrden).
  function cancelarOrden(autorizaId) {
    return sb.rpc('pos_cerrar_orden_llevar', { p_orden_id: ordenId, p_estado: 'cancelada', p_autoriza_id: autorizaId, ...firma() })
      .then(({ error }) => {
        if (error) {
          console.error('[llevar] cancelarOrden falló:', error)
          avisarError('no se pudo cancelar la orden', 'La orden sigue abierta')
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
    cambiarEmpaque,
    cambiarEmpaqueEnviado,
    cambiarCantidad,
    quitarItem,
    enviarACocina,
    enviando,
    fijarCantidadEnviado,
    cancelarEnviado,
    quitarItemEnviado,
    pagarOrden,
    cancelarOrden,
    descartarOrden,
  }
}
