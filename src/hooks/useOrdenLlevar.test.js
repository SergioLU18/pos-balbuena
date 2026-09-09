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
    expect(item.precio_unitario).toBe(110)
  })

  it('vacía el draft y deja el renglón del lado de "ya enviado"', () => {
    const { result, rerender } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    act(() => { result.current.enviarACocina() })
    rerender()

    expect(result.current.draft).toHaveLength(0)
    expect(result.current.enviados).toHaveLength(1)
    expect(result.current.subtotalEnviado).toBe(110)
  })
})

describe('useOrdenLlevar — cerrar la orden', () => {
  it('congela total y renglones en la orden y saca sus comandas del tablero de cocina', async () => {
    const { result, rerender } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    act(() => { result.current.agregarItemConstruido(buildDraftItem(sope, I_SENCILLO)) })
    act(() => { result.current.enviarACocina() })
    rerender()
    await act(async () => { await result.current.cerrarOrden('entregada') })

    const [orden] = useLlevarStore.getState().ordenes
    expect(orden.estado).toBe('entregada')
    expect(orden.total).toBe(110)
    expect(orden.items).toHaveLength(1) // la copia que sostiene el historial del cliente
    expect(orden.closedAt).toBeTruthy()
    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
  })

  it('no toca las comandas de OTRAS órdenes', async () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p-otra', tipo: 'llevar', ordenLlevarId: 'otra-orden', items: [], estado: 'pendiente' }],
    })
    const { result } = renderHook(() => useOrdenLlevar(ORDEN_ID))
    await act(async () => { await result.current.cerrarOrden('cancelada') })

    expect(usePedidosStore.getState().pedidos.map((p) => p.id)).toEqual(['p-otra'])
    expect(useLlevarStore.getState().ordenes[0].estado).toBe('cancelada')
  })
})
