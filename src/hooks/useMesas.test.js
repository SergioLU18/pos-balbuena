import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMesas } from './useMesas'
import { buildDraftItem } from './useOrderDraft'
import { useOrderStore, usePedidosStore, useMeseroStore } from '../store/appStore'
import { MENU } from '../lib/mockMenu'
import { MESAS } from '../lib/mockMesas'
import { MESEROS } from '../lib/mockMeseros'

const sope = MENU.find((p) => p.id === 'sope')
const I_2ING = sope.tiers.findIndex((t) => t.nombre === '2 Ingredientes') // -> 165
const mesa1 = MESAS[0]

beforeEach(() => {
  useOrderStore.setState({ drafts: {}, cuentas: {} })
  usePedidosStore.setState({ pedidos: [] })
  useMeseroStore.setState({ currentMeseroId: MESEROS[0].id, soloMisMesas: false })
})

describe('useMesas — total de una mesa con cuenta abierta', () => {
  it('suma el precio real de los renglones (tier + recargos), no un campo inexistente', () => {
    useOrderStore.setState({
      cuentas: { [mesa1.id]: { items: [buildDraftItem(sope, I_2ING)], createdAt: new Date().toISOString() } },
    })
    const { result } = renderHook(() => useMesas())
    const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
    expect(mesa.estado).toBe('abierta')
    expect(mesa.total).toBe(165)
  })
})

describe('useMesas — indicador de pedido listo', () => {
  it('marca tienePedidoListo cuando cocina avanzó el pedido de la mesa a "listo"', () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: mesa1.id, mesaNumero: mesa1.numero, meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'listo' }],
    })
    const { result } = renderHook(() => useMesas())
    const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
    expect(mesa.tienePedidoListo).toBe(true)
  })

  it('deja de marcar tienePedidoListo una vez que el mesero lo recoge ("entregado"), y la mesa vuelve a verse como cuenta abierta', () => {
    useOrderStore.setState({
      cuentas: { [mesa1.id]: { items: [buildDraftItem(sope, 1)], createdAt: new Date().toISOString() } },
    })
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: mesa1.id, mesaNumero: mesa1.numero, meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'entregado' }],
    })
    const { result } = renderHook(() => useMesas())
    const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
    expect(mesa.tienePedidoListo).toBe(false)
    expect(mesa.estado).toBe('abierta')
  })

  it('marca tieneEnPreparacion cuando cocina ya empezó a cocinar el pedido de la mesa', () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: mesa1.id, mesaNumero: mesa1.numero, meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'preparando' }],
    })
    const { result } = renderHook(() => useMesas())
    const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
    expect(mesa.tieneEnPreparacion).toBe(true)
    expect(mesa.tienePedidoListo).toBe(false)
  })

  it('marca tienePedidoPendiente cuando el pedido ya se envió pero cocina aún no lo empieza', () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: mesa1.id, mesaNumero: mesa1.numero, meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'pendiente' }],
    })
    const { result } = renderHook(() => useMesas())
    const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
    expect(mesa.tienePedidoPendiente).toBe(true)
    expect(mesa.tieneEnPreparacion).toBe(false)
    expect(mesa.tienePedidoListo).toBe(false)
  })
})
