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
  useMeseroStore.setState({ currentMeseroId: MESEROS[0].id, soloMisMesas: false })
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS, asignaciones: ASIGNACIONES })
})

// mesa-5 arranca compartida entre Doña Rosa (MESEROS[0]) y Don Beto (MESEROS[1]).
const compartida = MESAS[4]

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

describe('useMesas — una mesa con varios meseros', () => {
  it('lista a todos los que atienden la mesa y la marca como compartida', () => {
    const { result } = renderHook(() => useMesas())
    const mesa = result.current.mesas.find((m) => m.id === compartida.id)
    expect(mesa.meseros.map((w) => w.id)).toEqual([MESEROS[0].id, MESEROS[1].id])
    expect(mesa.compartida).toBe(true)
  })

  it('la mesa compartida es "mía" para los dos meseros que la atienden', () => {
    const paraMesero = (id) => {
      useMeseroStore.setState({ currentMeseroId: id })
      const { result } = renderHook(() => useMesas())
      return result.current.mesas.find((m) => m.id === compartida.id)
    }
    expect(paraMesero(MESEROS[0].id).esMia).toBe(true)
    expect(paraMesero(MESEROS[1].id).esMia).toBe(true)
    expect(paraMesero(MESEROS[2].id).esMia).toBe(false)
  })

  it('"solo mis mesas" deja ver la compartida sin colar las del otro mesero', () => {
    useMeseroStore.setState({ currentMeseroId: MESEROS[1].id, soloMisMesas: true })
    const { result } = renderHook(() => useMesas())
    const numeros = result.current.mesas.map((m) => m.numero)
    expect(numeros).toContain(compartida.numero) // la comparte con Doña Rosa
    expect(numeros).not.toContain('1') // esa sí es solo de Doña Rosa
  })

  it('cuenta como mía una mesa ajena donde mandé un pedido, aunque no me la hayan asignado', () => {
    // El hueco real: mando la orden y el backend todavía no confirma la asignación.
    // Sin esto, "solo mis mesas" escondería la mesa que acabo de atender.
    const ajena = MESAS[0] // de Doña Rosa
    useMeseroStore.setState({ currentMeseroId: MESEROS[2].id, soloMisMesas: true })
    usePedidosStore.setState({
      pedidos: [{ id: 'p-ajena', mesaId: ajena.id, mesaNumero: ajena.numero, meseroId: MESEROS[2].id, meseroNombre: 'Lupita', items: [], enviadoAt: new Date().toISOString(), estado: 'pendiente' }],
    })
    const { result } = renderHook(() => useMesas())
    expect(result.current.mesas.map((m) => m.id)).toContain(ajena.id)
  })

  it('el pedido de OTRO mesero no me hace dueño de la mesa', () => {
    const ajena = MESAS[0]
    useMeseroStore.setState({ currentMeseroId: MESEROS[2].id, soloMisMesas: true })
    usePedidosStore.setState({
      pedidos: [{ id: 'p-otro', mesaId: ajena.id, mesaNumero: ajena.numero, meseroId: MESEROS[0].id, meseroNombre: 'Doña Rosa', items: [], enviadoAt: new Date().toISOString(), estado: 'pendiente' }],
    })
    const { result } = renderHook(() => useMesas())
    expect(result.current.mesas.map((m) => m.id)).not.toContain(ajena.id)
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

  it('"solo mis mesas" enseña el grupo completo si atiendo cualquiera de sus mesas', () => {
    usePosStore.setState({ mesas: unidas(), asignaciones: [{ mesaId: 'mesa-2', meseroId: MESEROS[2].id }] })
    useMeseroStore.setState({ currentMeseroId: MESEROS[2].id, soloMisMesas: true })
    const { result } = renderHook(() => useMesas())
    expect(result.current.mesas.map((m) => m.id)).toEqual(['mesa-1', 'mesa-2'])
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
