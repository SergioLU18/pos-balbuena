import { INGREDIENTES } from '../lib/mockMenu'
import { uid } from '../lib/utils'
import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { describirMitades } from '../lib/describirItem'
import { useMeseroStore, useOrderStore, usePedidosStore, usePosStore } from '../store/appStore'

const extraCost = (nombreIngrediente) => INGREDIENTES.find((i) => i.nombre === nombreIngrediente)?.extra ?? 0

// Referencia estable para el fallback: si el selector devolviera un array literal
// nuevo (`?? []`) en cada llamada, useSyncExternalStore entra en loop infinito
// porque el snapshot nunca es referencialmente igual al anterior.
const EMPTY_ITEMS = []

/** Crea una línea de orden nueva a partir de un platillo y el índice de su tier elegido.
 *  Si el platillo tiene variantes de tortilla (p. ej. Tacos Dorados), `tortillaId` elige
 *  cuál define los tiers; por defecto se usa la primera variante. */
export function buildDraftItem(platillo, tierIndex, tortillaId) {
  const tortilla = platillo.tortillas
    ? (platillo.tortillas.find((t) => t.id === tortillaId) ?? platillo.tortillas[0])
    : null
  const tier = (tortilla ? tortilla.tiers : platillo.tiers)[tierIndex]
  return {
    id: uid('item'),
    platilloId: platillo.id,
    platilloNombre: tortilla ? `${platillo.nombre} (${tortilla.nombre})` : platillo.nombre,
    tortillaId: tortilla?.id,
    categoria: platillo.categoria,
    permiteMitades: platillo.permiteMitades,
    permiteNota: platillo.permiteNota,
    tierIndex,
    tier,
    dividido: false,
    mitades: [{ lado: 'completo', ingredientes: [], modificadores: [] }],
    cantidad: 1,
    nota: '',
  }
}

/** Activa/desactiva la división en mitades, preservando lo ya elegido en la primera mitad. */
export function toggleDividido(item) {
  if (item.dividido) {
    return { ...item, dividido: false, mitades: [{ ...item.mitades[0], lado: 'completo' }] }
  }
  const primera = item.mitades[0] ?? { ingredientes: [], modificadores: [] }
  return {
    ...item,
    dividido: true,
    mitades: [
      { lado: 'izquierda', ingredientes: primera.ingredientes ?? [], modificadores: primera.modificadores ?? [] },
      { lado: 'derecha', ingredientes: [], modificadores: [] },
    ],
  }
}

export function setMitadField(item, lado, field, value) {
  return { ...item, mitades: item.mitades.map((m) => (m.lado === lado ? { ...m, [field]: value } : m)) }
}

/** Precio unitario del renglón: precio del tier + recargos de todos los ingredientes elegidos (ambas mitades). */
export function calcItemPrecio(item) {
  const recargos = item.mitades.reduce(
    (sum, m) => sum + m.ingredientes.reduce((s, ing) => s + extraCost(ing), 0),
    0,
  )
  return item.tier.precio + recargos
}

export function calcSubtotal(items) {
  return items.reduce((s, it) => s + calcItemPrecio(it) * it.cantidad, 0)
}

// Nombre facturable de un renglón para cuenta_items de tali (plano). Incluye el tier y,
// si hay personalización real, un resumen entre paréntesis para distinguir renglones.
export function nombreItem(item) {
  const base = `${item.platilloNombre} · ${item.tier.nombre}`
  const partes = describirMitades(item)
    .map((d) => `${d.prefijo}${d.texto}`)
    .filter((t) => t && !/Sin personalizar$/.test(t))
  return partes.length ? `${base} (${partes.join(' / ')})` : base
}

// Total de una cuenta ya enviada. Soporta ambas formas de renglón: los planos del
// backend (precio_unitario · cantidad) y los ricos del modo mock (calcItemPrecio).
export function sumaCuenta(items) {
  return (items ?? []).reduce((s, it) => {
    const precio = it.precio_unitario != null ? Number(it.precio_unitario) : calcItemPrecio(it)
    return s + precio * it.cantidad
  }, 0)
}

/** Hook de feature: expone el draft de una mesa y las operaciones de negocio sobre él. */
export function useOrderDraft(mesaId) {
  const draft = useOrderStore((s) => s.drafts[mesaId] ?? EMPTY_ITEMS)
  const cuenta = useOrderStore((s) => s.cuentas[mesaId] ?? null)
  const addDraftItem = useOrderStore((s) => s.addDraftItem)
  const updateDraftItem = useOrderStore((s) => s.updateDraftItem)
  const removeDraftItem = useOrderStore((s) => s.removeDraftItem)
  const enviarOrden = useOrderStore((s) => s.enviarOrden)
  const clearDraft = useOrderStore((s) => s.clearDraft)
  const actualizarCantidadItemCuenta = useOrderStore((s) => s.actualizarCantidadItemCuenta)
  const quitarItemCuenta = useOrderStore((s) => s.quitarItemCuenta)
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const agregarPedido = usePedidosStore((s) => s.agregarPedido)
  const cerrarCuenta = useOrderStore((s) => s.cerrarCuenta)
  const eliminarPedidosDeMesa = usePedidosStore((s) => s.eliminarPedidosDeMesa)
  const pedidosMesa = usePedidosStore((s) => s.pedidos).filter((p) => p.mesaId === mesaId)
  const actualizarCantidadItemPedido = usePedidosStore((s) => s.actualizarCantidadItemPedido)
  const quitarItemPedido = usePedidosStore((s) => s.quitarItemPedido)
  const mesas = usePosStore((s) => s.mesas)
  const meseros = usePosStore((s) => s.meseros)

  function agregarPlatillo(platillo, tierIndex) {
    addDraftItem(mesaId, buildDraftItem(platillo, tierIndex))
  }

  /** Agrega un renglón ya construido (p. ej. armado por ConfigurarPlatilloModal, con
   *  tier/mitades/ingredientes/modificadores/cantidad/nota ya elegidos por el mesero). */
  function agregarItemConstruido(item) {
    addDraftItem(mesaId, item)
  }

  function cambiarCantidad(itemId, delta) {
    const item = draft.find((i) => i.id === itemId)
    if (!item) return
    const cantidad = Math.max(1, item.cantidad + delta)
    updateDraftItem(mesaId, itemId, { cantidad })
  }

  function cambiarDividido(itemId) {
    const item = draft.find((i) => i.id === itemId)
    if (!item) return
    updateDraftItem(mesaId, itemId, toggleDividido(item))
  }

  function cambiarMitad(itemId, lado, field, value) {
    const item = draft.find((i) => i.id === itemId)
    if (!item) return
    updateDraftItem(mesaId, itemId, setMitadField(item, lado, field, value))
  }

  function cambiarNota(itemId, nota) {
    updateDraftItem(mesaId, itemId, { nota })
  }

  function quitarItem(itemId) {
    removeDraftItem(mesaId, itemId)
  }

  function enviarACocina() {
    if (draft.length === 0) return
    const mesero = meseros.find((m) => m.id === currentMeseroId)

    if (!IS_MOCK) {
      // Backend: cada renglón lleva nombre + precio_unitario (para cuenta_items de tali)
      // y además su estructura rica completa (para la comanda de cocina en pedidos.items).
      // La RPC abre la cuenta si hace falta, agrega los renglones con las funciones de
      // tali, recalcula el subtotal y crea el pedido — todo atómico. Realtime refresca.
      const payload = draft.map((it) => ({
        ...it,
        nombre: nombreItem(it),
        precio_unitario: calcItemPrecio(it),
      }))
      sb.rpc('pos_enviar_orden', {
        p_mesa_id: mesaId,
        p_mesero_nombre: mesero?.nombre ?? '—',
        p_items: payload,
      }).then(({ error }) => {
        if (error) console.error('[orden] enviarACocina falló:', error)
        else clearDraft(mesaId)
      })
      return
    }

    const mesa = mesas.find((m) => m.id === mesaId)
    agregarPedido({
      id: uid('pedido'),
      mesaId,
      mesaNumero: mesa?.numero ?? '—',
      meseroNombre: mesero?.nombre ?? '—',
      items: draft,
      enviadoAt: new Date().toISOString(),
      estado: 'pendiente',
    })
    enviarOrden(mesaId)
  }

  // Edición de un renglón ya enviado a cocina. Solo tiene efecto mientras su pedido
  // sigue en 'pendiente' (Nuevo) — en backend lo valida el RPC del lado del servidor;
  // en mock, actualizarCantidadItemPedido/quitarItemPedido son no-op fuera de ese estado.
  // La UI (OrderTicket) ya solo muestra estos controles para pedidos 'pendiente', así
  // que en el flujo normal esa condición no llega a activarse.
  function cambiarCantidadEnviado(pedidoId, itemId, delta) {
    if (!IS_MOCK) {
      const pedido = pedidosMesa.find((p) => p.id === pedidoId)
      const item = pedido?.items.find((it) => it.id === itemId)
      if (!item) return
      const cantidad = Math.max(1, item.cantidad + delta)
      sb.rpc('pos_editar_item_pedido', { p_pedido_id: pedidoId, p_item_id: itemId, p_cantidad: cantidad })
        .then(({ error }) => { if (error) console.error('[orden] cambiarCantidadEnviado falló:', error) })
      return
    }

    const pedido = pedidosMesa.find((p) => p.id === pedidoId)
    const item = pedido?.items.find((it) => it.id === itemId)
    if (!item || pedido.estado !== 'pendiente') return
    const cantidad = Math.max(1, item.cantidad + delta)
    actualizarCantidadItemPedido(pedidoId, itemId, cantidad)
    actualizarCantidadItemCuenta(mesaId, itemId, cantidad)
  }

  function quitarItemEnviado(pedidoId, itemId) {
    if (!IS_MOCK) {
      sb.rpc('pos_eliminar_item_pedido', { p_pedido_id: pedidoId, p_item_id: itemId })
        .then(({ error }) => { if (error) console.error('[orden] quitarItemEnviado falló:', error) })
      return
    }

    const pedido = pedidosMesa.find((p) => p.id === pedidoId)
    if (!pedido || pedido.estado !== 'pendiente') return
    quitarItemPedido(pedidoId, itemId)
    quitarItemCuenta(mesaId, itemId)
  }

  // TEMPORAL: en la integración real, la cuenta se cierra desde la app de pagos
  // (cuando se liquida por completo). Mientras no exista esa conexión, esto le da
  // al mesero una forma manual de liberar la mesa para poder abrir una nueva.
  function cerrarMesa() {
    if (!IS_MOCK) {
      sb.rpc('pos_cerrar_mesa', { p_mesa_id: mesaId })
        .then(({ error }) => { if (error) console.error('[orden] cerrarMesa falló:', error) })
      return
    }
    cerrarCuenta(mesaId)
    eliminarPedidosDeMesa(mesaId)
  }

  const subtotalDraft = calcSubtotal(draft)
  const subtotalCuenta = sumaCuenta(cuenta?.items ?? [])

  return {
    draft,
    cuenta,
    subtotalDraft,
    subtotalCuenta,
    agregarPlatillo,
    agregarItemConstruido,
    cambiarCantidad,
    cambiarDividido,
    cambiarMitad,
    cambiarNota,
    quitarItem,
    enviarACocina,
    cambiarCantidadEnviado,
    quitarItemEnviado,
    cerrarMesa,
  }
}
