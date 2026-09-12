import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMesas } from './useMesas'
import { buildDraftItem } from './useOrderDraft'
import { useOrderStore, usePedidosStore, useMeseroStore, useMesaPagadaStore, usePosStore } from '../store/appStore'
import { MENU } from '../lib/mockMenu'
import { MESAS } from '../lib/mockMesas'
import { MESEROS, ASIGNACIONES } from '../lib/mockMeseros'

const sope = MENU.find((p) => p.id === 'sope')
const I_2ING = sope.tiers.findIndex((t) => t.nombre === '2 Ingredientes') // -> 165
const mesa1 = MESAS[0]

beforeEach(() => {
  useOrderStore.setState({ drafts: {}, cuentas: {} })
  usePedidosStore.setState({ pedidos: [] })
  useMesaPagadaStore.setState({ pagadas: {} })
  useMeseroStore.setState({ currentMeseroId: MESEROS[0].id })
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS, asignaciones: ASIGNACIONES })
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

describe('useMesas — mesa pagada', () => {
  it('marca estado "pagada" con su total cuando la mesa se cobró y no tiene cuenta ni draft', () => {
    useMesaPagadaStore.setState({ pagadas: { [mesa1.id]: { at: new Date().toISOString(), total: 165 } } })
    const { result } = renderHook(() => useMesas())
    const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
    expect(mesa.estado).toBe('pagada')
    expect(mesa.pagada).toBe(true)
    expect(mesa.total).toBe(165)
  })

  it('un draft nuevo (aún sin enviar) tiene prioridad sobre el badge de pagada', () => {
    useMesaPagadaStore.setState({ pagadas: { [mesa1.id]: { at: new Date().toISOString(), total: 165 } } })
    useOrderStore.setState({ drafts: { [mesa1.id]: [buildDraftItem(sope, I_2ING)] } })
    const { result } = renderHook(() => useMesas())
    const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
    expect(mesa.estado).toBe('abierta')
    expect(mesa.total).toBe(165)
  })
})

describe('useMesas — mesas unidas', () => {
  // La 2 se juntó a la 1.
  const unidas = () => MESAS.map((m) => (m.id === 'mesa-2' ? { ...m, joined_to: 'mesa-1' } : m))

  it('la secundaria sabe su principal y la principal sabe sus secundarias', () => {
    usePosStore.setState({ mesas: unidas() })
    const { result } = renderHook(() => useMesas())
    const uno = result.current.mesas.find((m) => m.id === 'mesa-1')
    const dos = result.current.mesas.find((m) => m.id === 'mesa-2')
    expect(dos.unidaA).toEqual({ id: 'mesa-1', numero: '1' })
    expect(uno.unidaA).toBeNull()
    expect(uno.unidas).toEqual([{ id: 'mesa-2', numero: '2' }])
  })

  it('una principal dada de baja deja a la secundaria como suelta', () => {
    usePosStore.setState({ mesas: unidas().filter((m) => m.id !== 'mesa-1') })
    const { result } = renderHook(() => useMesas())
    expect(result.current.mesas.find((m) => m.id === 'mesa-2').unidaA).toBeNull()
  })
})

describe('useMesas — solo dos estados de cuenta (el detalle de cocina no se ve en el piso)', () => {
  it.each(['pendiente', 'preparando', 'listo', 'entregado'])(
    'con cuenta abierta, la mesa se ve "abierta" sin importar la sub-etapa de cocina (%s)',
    (estadoPedido) => {
      useOrderStore.setState({
        cuentas: { [mesa1.id]: { items: [buildDraftItem(sope, 1)], createdAt: new Date().toISOString() } },
      })
      usePedidosStore.setState({
        pedidos: [{ id: 'p1', mesaId: mesa1.id, mesaNumero: mesa1.numero, meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: estadoPedido }],
      })
      const { result } = renderHook(() => useMesas())
      const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
      expect(mesa.estado).toBe('abierta')
    },
  )
})
