import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOrdenLlevar } from './useOrdenLlevar'
import { buildDraftItem } from './useOrderDraft'
import { useLlevarStore, useMeseroStore, useOrderStore, usePedidosStore, usePosStore } from '../store/appStore'
import { MESEROS } from '../lib/mockMeseros'
import { MENU } from '../lib/mockMenu'

const ORDEN_ID = 'llevar-1'
const sope = MENU.find((p) => p.id === 'sope')
const I_SENCILLO = sope.tiers.findIndex((t) => t.nombre === 'Sencillo') // 110

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

beforeEach(() => {
  useLlevarStore.setState({ clientes: [], ordenes: [ORDEN] })
  usePedidosStore.setState({ pedidos: [] })
  useOrderStore.setState({ drafts: {}, cuentas: {} })
  usePosStore.setState({ meseros: MESEROS })
  useMeseroStore.setState({ currentMeseroId: MESEROS[0].id })
})

describe('useOrdenLlevar — enviar a cocina', () => {
  it('manda una comanda SIN mesa, colgada de la orden y con el nombre del cliente', () => {
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    act(() => { result.current.enviarACocina() })

    const [pedido] = usePedidosStore.getState().pedidos
    expect(pedido.tipo).toBe('llevar')
    expect(pedido.mesaId).toBeNull()
    expect(pedido.ordenLlevarId).toBe(ORDEN_ID)
    expect(pedido.clienteNombre).toBe('Sra. Elena')
    expect(pedido.estado).toBe('pendiente') // entra al tablero de cocina como cualquier otra
  })

  it('el renglón enviado lleva nombre y precio_unitario, para poder totalizar sin el catálogo', () => {
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    act(() => { result.current.enviarACocina() })

    const [item] = usePedidosStore.getState().pedidos[0].items
    expect(item.nombre).toContain('Sope')
    expect(item.precio_unitario).toBe(115) // 110 del menú + 5 del desechable
  })

  it('vacía el draft y deja el renglón del lado de "ya enviado"', () => {
    const { result, rerender } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    act(() => { result.current.enviarACocina() })
    rerender()

    expect(result.current.draft).toHaveLength(0)
    expect(result.current.enviados).toHaveLength(1)
    expect(result.current.subtotalEnviado).toBe(115)
  })
})

describe('useOrdenLlevar — cobrar y entregar la orden en un solo paso', () => {
  it('congela total y renglones, guarda el método de pago y saca sus comandas del tablero de cocina', async () => {
    const { result, rerender } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    act(() => { result.current.enviarACocina() })
    rerender()
    await act(async () => { await result.current.pagarOrden('efectivo') })

    const [orden] = useLlevarStore.getState().ordenes
    expect(orden.estado).toBe('entregada')
    expect(orden.total).toBe(115)
    expect(orden.items).toHaveLength(1) // la copia que sostiene el historial del cliente
    expect(orden.metodoPago).toBe('efectivo')
    expect(orden.closedAt).toBeTruthy()
    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
  })
})

describe('useOrdenLlevar — cancelar la orden', () => {
  it('congela total y renglones en la orden y saca sus comandas del tablero de cocina', async () => {
    const { result, rerender } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    act(() => { result.current.enviarACocina() })
    rerender()
    await act(async () => { await result.current.cancelarOrden() })

    const [orden] = useLlevarStore.getState().ordenes
    expect(orden.estado).toBe('cancelada')
    expect(orden.total).toBe(115)
    expect(orden.items).toHaveLength(1) // la copia que sostiene el historial del cliente
    expect(orden.closedAt).toBeTruthy()
    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
  })

  it('no toca las comandas de OTRAS órdenes', async () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p-otra', tipo: 'llevar', ordenLlevarId: 'otra-orden', items: [], estado: 'pendiente' }],
    })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    await act(async () => { await result.current.cancelarOrden() })

    expect(usePedidosStore.getState().pedidos.map((p) => p.id)).toEqual(['p-otra'])
    expect(useLlevarStore.getState().ordenes[0].estado).toBe('cancelada')
  })
})

describe('useOrdenLlevar — descartar una orden vacía', () => {
  it('la borra en vez de cancelarla: no deja una cancelada de $0 en el historial', () => {
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    act(() => { result.current.descartarOrden() })

    expect(useLlevarStore.getState().ordenes).toHaveLength(0)
    expect(useOrderStore.getState().drafts[ORDEN_ID] ?? []).toHaveLength(0)
  })

  it('no descarta una orden que ya mandó platillos a cocina', () => {
    const { result, rerender } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    act(() => { result.current.enviarACocina() })
    rerender()
    act(() => { result.current.descartarOrden() })

    expect(useLlevarStore.getState().ordenes[0].estado).toBe('abierta')
    expect(usePedidosStore.getState().pedidos).toHaveLength(1)
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

  it('con tupper se cobra el precio del menú menos 5, por cada pieza', () => {
    const { result, rerender } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    rerender()
    const id = result.current.draft[0].id
    act(() => { result.current.cambiarCantidad(id, 1) })
    act(() => { result.current.cambiarEmpaque(id, 'tupper') })
    rerender()

    expect(result.current.subtotalDraft).toBe(2 * 105)
    act(() => { result.current.enviarACocina() })
    const [item] = usePedidosStore.getState().pedidos[0].items
    expect(item.precio_unitario).toBe(105)
    expect(item.nombre).toContain('tupper') // el renglón congelado explica el precio
  })

  it('el empaque de un renglón ya enviado se puede cambiar aunque cocina ya lo haya tomado', () => {
    const { result, rerender } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    act(() => { result.current.enviarACocina() })
    const [pedido] = usePedidosStore.getState().pedidos
    usePedidosStore.setState({ pedidos: [{ ...pedido, estado: 'preparando' }] })
    rerender()
    act(() => { result.current.cambiarEmpaqueEnviado(pedido.id, pedido.items[0].id, 'tupper') })
    rerender()

    const [item] = usePedidosStore.getState().pedidos[0].items
    expect(item.empaque).toBe('tupper')
    expect(item.precio_unitario).toBe(105)
    expect(result.current.subtotalEnviado).toBe(105)
  })
})
