import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMesas } from './useMesas'
import { buildDraftItem, useOrderDraft } from './useOrderDraft'
import { useOrderStore, usePedidosStore, useMeseroStore, useMesaPagadaStore, useAvisosStore, usePosStore } from '../store/appStore'
import { responderRpc, llamadasRpc, vaciarPromesas } from '../test/sbFalso'
import { MENU } from '../test/fixtures/menu'
import { MESAS } from '../test/fixtures/mesas'
import { MESEROS } from '../test/fixtures/meseros'

const sope = MENU.find((p) => p.id === 'sope')
const I_2ING = sope.tiers.findIndex((t) => t.nombre === '2 Ingredientes') // -> 165
const mesa1 = MESAS[0]

// Renglones de cuenta_items tal como llegan de Supabase: planos, con su precio ya fijado.
const cuentaAbierta = () => ({
  cuentaId: 'cuenta-1',
  items: [
    { id: 'ci-1', nombre: 'Sope', precio_unitario: 165, cantidad: 2 },
    { id: 'ci-2', nombre: 'Sope', precio_unitario: 40, cantidad: 1 },
  ],
  createdAt: new Date().toISOString(),
})

beforeEach(() => {
  useOrderStore.setState({ drafts: {}, cuentas: {} })
  usePedidosStore.setState({ pedidos: [] })
  useMesaPagadaStore.setState({ pagadas: {} })
  useAvisosStore.setState({ avisos: [] })
})

describe('useMesas — total de una mesa con cuenta abierta', () => {
  it('suma precio_unitario × cantidad de los renglones de la cuenta', () => {
    useOrderStore.setState({ cuentas: { [mesa1.id]: cuentaAbierta() } })
    const { result } = renderHook(() => useMesas())
    const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
    expect(mesa.estado).toBe('abierta')
    expect(mesa.total).toBe(370)
    expect(mesa.itemCount).toBe(2)
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

  it('al cerrar la cuenta (pos_cerrar_mesa OK) la mesa queda "pagada" con el total cobrado', async () => {
    useOrderStore.setState({ cuentas: { [mesa1.id]: cuentaAbierta() } })
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: mesa1.id, mesaNumero: mesa1.numero, items: [{ ...buildDraftItem(sope, I_2ING), nombre: 'Sope', precio_unitario: 165 }], estado: 'entregado' }],
    })
    const { result: orden } = renderHook(() => useOrderDraft(mesa1.id))
    const { result } = renderHook(() => useMesas())

    await act(async () => {
      orden.current.cerrarMesa('efectivo', { efectivo: 370 })
      await vaciarPromesas()
    })

    expect(llamadasRpc('pos_cerrar_mesa')).toEqual([expect.objectContaining({
      p_mesa_id: mesa1.id,
      p_metodo_pago: 'efectivo',
      p_monto_efectivo: 370,
      p_mesero_id: MESEROS[0].id,
      p_mesero_nombre: MESEROS[0].nombre,
    })])
    const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
    expect(mesa.estado).toBe('pagada')
    expect(mesa.total).toBe(370)
    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
  })

  it('si pos_cerrar_mesa falla, la mesa sigue abierta y avisa en la campana', async () => {
    responderRpc('pos_cerrar_mesa', { error: { message: 'boom' } })
    useOrderStore.setState({ cuentas: { [mesa1.id]: cuentaAbierta() } })
    const { result: orden } = renderHook(() => useOrderDraft(mesa1.id))
    const { result } = renderHook(() => useMesas())

    await act(async () => {
      orden.current.cerrarMesa('tarjeta', { tarjeta: 370 })
      await vaciarPromesas()
    })

    const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
    expect(mesa.estado).toBe('abierta')
    expect(mesa.total).toBe(370)
    expect(useAvisosStore.getState().avisos).toHaveLength(1)
  })
})

describe('useMesas — sin reparto de mesas', () => {
  it('todos los meseros ven el salón completo', () => {
    for (const w of MESEROS) {
      useMeseroStore.setState({ currentMeseroId: w.id })
      const { result } = renderHook(() => useMesas())
      expect(result.current.mesas).toHaveLength(MESAS.length)
    }
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
      useOrderStore.setState({ cuentas: { [mesa1.id]: cuentaAbierta() } })
      usePedidosStore.setState({
        pedidos: [{ id: 'p1', mesaId: mesa1.id, mesaNumero: mesa1.numero, meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: estadoPedido }],
      })
      const { result } = renderHook(() => useMesas())
      const mesa = result.current.mesas.find((m) => m.id === mesa1.id)
      expect(mesa.estado).toBe('abierta')
    },
  )
})
