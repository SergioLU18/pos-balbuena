import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOrdenLlevar } from './useOrdenLlevar'
import { buildDraftItem, calcItemPrecio, nombreItem } from './useOrderDraft'
import { conEmpaque } from '../lib/empaque'
import {
  useAvisosStore, useLlevarStore, useMeseroStore, useOrderStore, usePedidosStore, usePosStore,
} from '../store/appStore'
import { sb, llamadasRpc, responderRpc, vaciarPromesas } from '../test/sbFalso'
import { MESEROS } from '../test/fixtures/meseros'
import { MENU } from '../test/fixtures/menu'

const ORDEN_ID = 'llevar-1'
const sope = MENU.find((p) => p.id === 'sope')
const I_SENCILLO = sope.tiers.findIndex((t) => t.nombre === 'Sencillo') // 110
const FIRMA = { p_mesero_id: MESEROS[0].id, p_mesero_nombre: MESEROS[0].nombre }

const ORDEN = {
  id: ORDEN_ID,
  folio: 1,
  clienteId: 'cli-1',
  clienteNombre: 'Sra. Elena',
  clienteTelefono: '5512345678',
  direccion: 'Oriente 168 #23',
  meseroId: MESEROS[0].id,
  meseroNombre: MESEROS[0].nombre,
  estado: 'abierta',
  total: 0,
  items: [],
  createdAt: new Date().toISOString(),
  closedAt: null,
}

/** Un renglón como lo manda el hook a cocina (estructura rica + nombre + precio_unitario). */
function renglonEnviado(empaque = 'plastico') {
  const it = conEmpaque(buildDraftItem(sope, I_SENCILLO), empaque)
  return { ...it, nombre: nombreItem(it), precio_unitario: calcItemPrecio(it) }
}

/** La comanda de la orden tal como llega por Realtime tras pos_enviar_orden_llevar. */
function comandaEnviada(extra = {}) {
  return {
    id: 'p-1',
    tipo: 'llevar',
    mesaId: null,
    ordenLlevarId: ORDEN_ID,
    clienteNombre: 'Sra. Elena',
    estado: 'pendiente',
    items: [renglonEnviado()],
    ...extra,
  }
}

beforeEach(() => {
  useLlevarStore.setState({ clientes: [], ordenes: [ORDEN] })
  usePedidosStore.setState({ pedidos: [] })
  useOrderStore.setState({ drafts: {}, cuentas: {} })
  useAvisosStore.setState({ avisos: [] })
  usePosStore.setState({ meseros: MESEROS })
  useMeseroStore.setState({ currentMeseroId: MESEROS[0].id })
})

describe('useOrdenLlevar — enviar a cocina', () => {
  it('manda la comanda colgada de la orden, firmada por el mesero en sesión', async () => {
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    await act(async () => { result.current.enviarACocina(); await vaciarPromesas() })

    const [params] = llamadasRpc('pos_enviar_orden_llevar')
    expect(params.p_orden_id).toBe(ORDEN_ID)
    expect(params.p_mesero_id).toBe(MESEROS[0].id)
    expect(params.p_mesero_nombre).toBe(MESEROS[0].nombre)
    expect(params.p_items).toHaveLength(1)
    // El pedido NO se agrega localmente: llega a cocina por Realtime
    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
  })

  it('el renglón enviado lleva nombre y precio_unitario, para poder totalizar sin el catálogo', async () => {
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    await act(async () => { result.current.enviarACocina(); await vaciarPromesas() })

    const [item] = llamadasRpc('pos_enviar_orden_llevar')[0].p_items
    expect(item.nombre).toContain('Sope')
    expect(item.precio_unitario).toBe(115) // 110 del menú + 5 del desechable
    expect(item.empaque).toBe('plastico')
  })

  it('vacía el draft solo cuando el backend confirma', async () => {
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    await act(async () => { result.current.enviarACocina(); await vaciarPromesas() })

    expect(result.current.draft).toHaveLength(0)
    expect(result.current.enviando).toBe(false)
  })

  it('ya enviada (llegó su comanda), el renglón queda del lado de "ya enviado"', () => {
    usePedidosStore.setState({ pedidos: [comandaEnviada()] })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))

    expect(result.current.enviados).toHaveLength(1)
    expect(result.current.subtotalEnviado).toBe(115)
  })

  it('si el backend falla, el draft sigue en pantalla y se avisa', async () => {
    responderRpc('pos_enviar_orden_llevar', { error: { message: 'sin red' } })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    await act(async () => { result.current.enviarACocina(); await vaciarPromesas() })

    expect(result.current.draft).toHaveLength(1)
    expect(result.current.enviando).toBe(false)
    const [aviso] = useAvisosStore.getState().avisos
    expect(aviso.tipo).toBe('error')
    expect(aviso.titulo).toContain('L-1')
  })

  it('un doble toque en "Enviar" no manda la comanda dos veces', async () => {
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    await act(async () => {
      result.current.enviarACocina()
      result.current.enviarACocina()
      await vaciarPromesas()
    })

    expect(llamadasRpc('pos_enviar_orden_llevar')).toHaveLength(1)
  })
})

describe('useOrdenLlevar — editar un renglón ya enviado', () => {
  it('fija la cantidad en el acto y la confirma con pos_editar_item_pedido', async () => {
    usePedidosStore.setState({ pedidos: [comandaEnviada()] })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    const itemId = result.current.enviados[0].id
    await act(async () => { result.current.fijarCantidadEnviado('p-1', itemId, 3); await vaciarPromesas() })

    expect(usePedidosStore.getState().pedidos[0].items[0].cantidad).toBe(3)
    expect(llamadasRpc('pos_editar_item_pedido')).toEqual([
      { p_pedido_id: 'p-1', p_item_id: itemId, p_cantidad: 3, ...FIRMA },
    ])
  })

  it('si el backend rechaza el cambio, avisa y recarga desde el backend', async () => {
    responderRpc('pos_editar_item_pedido', { error: { message: 'cocina ya lo tomó' } })
    usePedidosStore.setState({ pedidos: [comandaEnviada()] })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    const itemId = result.current.enviados[0].id
    await act(async () => { result.current.fijarCantidadEnviado('p-1', itemId, 2); await vaciarPromesas() })

    expect(useAvisosStore.getState().avisos).toHaveLength(1)
    expect(sb.from).toHaveBeenCalled() // cargarTodo trae la versión buena
  })

  it('quitar un renglón lo saca del ticket y lo confirma con pos_eliminar_item_pedido', async () => {
    usePedidosStore.setState({ pedidos: [comandaEnviada()] })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    const itemId = result.current.enviados[0].id
    await act(async () => { result.current.quitarItemEnviado('p-1', itemId, 'mesero-1'); await vaciarPromesas() })

    expect(usePedidosStore.getState().pedidos).toHaveLength(0) // comanda vacía, fuera
    expect(llamadasRpc('pos_eliminar_item_pedido')).toEqual([{ p_pedido_id: 'p-1', p_item_id: itemId, p_autoriza_id: 'mesero-1', ...FIRMA }])
  })
})

describe('useOrdenLlevar — cobrar y entregar la orden en un solo paso', () => {
  it('manda pos_pagar_orden_llevar con el método de pago y limpia el draft', async () => {
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    let r
    await act(async () => { r = await result.current.pagarOrden('mixto', { efectivo: 50, tarjeta: 65 }) })

    expect(r).toEqual({ error: null })
    // Congelar total/renglones y sacar las comandas del tablero lo hace el servidor
    expect(llamadasRpc('pos_pagar_orden_llevar')).toEqual([{
      p_orden_id: ORDEN_ID, p_metodo_pago: 'mixto', p_monto_efectivo: 50, p_monto_tarjeta: 65, ...FIRMA,
    }])
    expect(result.current.draft).toHaveLength(0)
  })

  it('si el cobro falla, regresa el error, avisa y la orden sigue como estaba', async () => {
    responderRpc('pos_pagar_orden_llevar', { error: { message: 'sin red' } })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    let r
    await act(async () => { r = await result.current.pagarOrden('efectivo') })

    expect(r).toEqual({ error: 'sin red' })
    expect(result.current.draft).toHaveLength(1)
    expect(useAvisosStore.getState().avisos).toHaveLength(1)
  })
})

describe('useOrdenLlevar — cancelar la orden', () => {
  it('manda pos_cerrar_orden_llevar como cancelada y limpia el draft', async () => {
    usePedidosStore.setState({ pedidos: [comandaEnviada()] })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    let r
    await act(async () => { r = await result.current.cancelarOrden('mesero-1') })

    expect(r).toEqual({ error: null })
    expect(llamadasRpc('pos_cerrar_orden_llevar')).toEqual([{ p_orden_id: ORDEN_ID, p_estado: 'cancelada', p_autoriza_id: 'mesero-1', ...FIRMA }])
    expect(result.current.draft).toHaveLength(0)
  })
})

describe('useOrdenLlevar — descartar una orden vacía', () => {
  it('la borra en vez de cancelarla: no deja una cancelada de $0 en el historial', async () => {
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    await act(async () => { result.current.descartarOrden(); await vaciarPromesas() })

    expect(useLlevarStore.getState().ordenes).toHaveLength(0)
    expect(useOrderStore.getState().drafts[ORDEN_ID] ?? []).toHaveLength(0)
    expect(llamadasRpc('pos_descartar_orden_llevar')).toEqual([{ p_orden_id: ORDEN_ID, ...FIRMA }])
    expect(llamadasRpc('pos_cerrar_orden_llevar')).toHaveLength(0)
  })

  it('no descarta una orden que ya mandó platillos a cocina', async () => {
    usePedidosStore.setState({ pedidos: [comandaEnviada()] })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    await act(async () => { result.current.descartarOrden(); await vaciarPromesas() })

    expect(useLlevarStore.getState().ordenes[0].estado).toBe('abierta')
    expect(usePedidosStore.getState().pedidos).toHaveLength(1)
    expect(llamadasRpc('pos_descartar_orden_llevar')).toHaveLength(0)
  })

  it('si el backend no la deja borrar, recarga para que vuelva', async () => {
    responderRpc('pos_descartar_orden_llevar', { error: { message: 'ya tiene platillos' } })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    await act(async () => { result.current.descartarOrden(); await vaciarPromesas() })

    expect(sb.from).toHaveBeenCalled()
  })
})

describe('useOrdenLlevar — empaque (desechable +$5 / tupper −$5, por pieza)', () => {
  const bebida = MENU.find((p) => p.id === 'bebida')

  it('todo entra en desechable, bebidas incluidas', () => {
    const { result, rerender } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    act(() => { result.current.agregarItemConstruido(buildDraftItem(bebida, 0)) })
    rerender()

    const [platillo, refresco] = result.current.draft
    expect(platillo.empaque).toBe('plastico')
    expect(refresco.empaque).toBe('plastico')
    expect(result.current.subtotalDraft).toBe(115 + 45)
  })

  it('con tupper se cobra el precio del menú menos 5, por cada pieza', async () => {
    const { result, rerender } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    rerender()
    const id = result.current.draft[0].id
    act(() => { result.current.cambiarCantidad(id, 1) })
    act(() => { result.current.cambiarEmpaque(id, 'tupper') })
    rerender()

    expect(result.current.subtotalDraft).toBe(2 * 105)
    await act(async () => { result.current.enviarACocina(); await vaciarPromesas() })
    const [item] = llamadasRpc('pos_enviar_orden_llevar')[0].p_items
    expect(item.precio_unitario).toBe(105)
    expect(item.nombre).toContain('tupper') // el renglón congelado explica el precio
  })

  it('el empaque de un renglón ya enviado se puede cambiar aunque cocina ya lo haya tomado', async () => {
    usePedidosStore.setState({ pedidos: [comandaEnviada({ estado: 'preparando' })] })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    const itemId = result.current.enviados[0].id
    await act(async () => { result.current.cambiarEmpaqueEnviado('p-1', itemId, 'tupper'); await vaciarPromesas() })

    const [item] = usePedidosStore.getState().pedidos[0].items
    expect(item.empaque).toBe('tupper')
    expect(item.precio_unitario).toBe(105)
    expect(result.current.subtotalEnviado).toBe(105)
    const [params] = llamadasRpc('pos_empaque_item_llevar')
    expect(params).toMatchObject({ p_pedido_id: 'p-1', p_item_id: itemId, p_empaque: 'tupper', p_ajuste: -5, ...FIRMA })
    expect(params.p_nombre).toContain('tupper')
  })

  it('si el cambio de empaque falla, avisa y recarga desde el backend', async () => {
    responderRpc('pos_empaque_item_llevar', { error: { message: 'orden cerrada' } })
    usePedidosStore.setState({ pedidos: [comandaEnviada()] })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    const itemId = result.current.enviados[0].id
    await act(async () => { result.current.cambiarEmpaqueEnviado('p-1', itemId, 'tupper'); await vaciarPromesas() })

    expect(useAvisosStore.getState().avisos).toHaveLength(1)
    expect(sb.from).toHaveBeenCalled()
  })
})
