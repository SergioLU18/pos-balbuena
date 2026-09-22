import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMesaAdmin } from './useMesaAdmin'
import { useOrderStore, usePedidosStore, usePosStore } from '../store/appStore'
import { MESAS } from '../lib/mockMesas'
import { MESEROS } from '../lib/mockMeseros'

beforeEach(() => {
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS })
  useOrderStore.setState({ drafts: {}, cuentas: {} })
  usePedidosStore.setState({ pedidos: [] })
})

describe('useMesaAdmin — crear mesa', () => {
  it('agrega la mesa nueva al catálogo', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    await act(async () => {
      await result.current.crearMesa('16')
    })
    const mesas = usePosStore.getState().mesas
    expect(mesas.some((m) => m.numero === '16')).toBe(true)
  })
})

describe('useMesaAdmin — nombre único', () => {
  it('no crea una mesa con un nombre que ya existe (sin distinguir mayúsculas)', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.crearMesa(MESAS[0].numero.toUpperCase())
    expect(error).toMatch(/[Yy]a existe/)
    expect(usePosStore.getState().mesas.length).toBe(MESAS.length)
  })

})

describe('useMesaAdmin — renombrar mesa', () => {
  it('cambia el nombre de la mesa', async () => {
    const mesa = MESAS[0]
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.renombrarMesa(mesa.id, 'Terraza 1')
    expect(error).toBeNull()
    expect(usePosStore.getState().mesas.find((m) => m.id === mesa.id).numero).toBe('Terraza 1')
  })

  it('propaga el nombre nuevo a las comandas de esa mesa (cocina canta el nombre)', async () => {
    const mesa = MESAS[0]
    usePedidosStore.setState({
      pedidos: [
        { id: 'p1', mesaId: mesa.id, mesaNumero: mesa.numero, items: [], estado: 'pendiente' },
        { id: 'p2', mesaId: MESAS[1].id, mesaNumero: MESAS[1].numero, items: [], estado: 'pendiente' },
      ],
    })
    const { result } = renderHook(() => useMesaAdmin())
    await result.current.renombrarMesa(mesa.id, 'Terraza 1')
    const pedidos = usePedidosStore.getState().pedidos
    expect(pedidos.find((p) => p.id === 'p1').mesaNumero).toBe('Terraza 1')
    // La comanda de OTRA mesa no se toca.
    expect(pedidos.find((p) => p.id === 'p2').mesaNumero).toBe(MESAS[1].numero)
  })

  it('no permite renombrar a un nombre que ya usa otra mesa', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.renombrarMesa(MESAS[0].id, MESAS[1].numero)
    expect(error).toMatch(/[Yy]a existe/)
    expect(usePosStore.getState().mesas.find((m) => m.id === MESAS[0].id).numero).toBe(MESAS[0].numero)
  })
})

describe('useMesaAdmin — reordenar mesas', () => {
  it('deja las mesas en el orden de ids recibido', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    const invertido = [...MESAS].reverse().map((m) => m.id)
    await result.current.reordenarMesas(invertido)
    expect(usePosStore.getState().mesas.map((m) => m.id)).toEqual(invertido)
  })

  it('conserva las mesas que no venían en la lista, al final', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    const soloDos = [MESAS[2].id, MESAS[0].id]
    await result.current.reordenarMesas(soloDos)
    const ids = usePosStore.getState().mesas.map((m) => m.id)
    expect(ids.slice(0, 2)).toEqual(soloDos)
    expect(ids.length).toBe(MESAS.length)
  })
})

describe('useMesaAdmin — borrar mesa', () => {
  it('quita la mesa del catálogo', async () => {
    const mesa = MESAS[4]
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.borrarMesa(mesa.id)
    expect(error).toBeNull()
    expect(usePosStore.getState().mesas.some((m) => m.id === mesa.id)).toBe(false)
  })

  it('no borra una mesa con cuenta abierta y devuelve un error', async () => {
    const mesa1 = MESAS[0]
    useOrderStore.setState({ cuentas: { [mesa1.id]: { items: [], createdAt: new Date().toISOString() } } })
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.borrarMesa(mesa1.id)
    expect(error).toMatch(/cuenta abierta/)
    expect(usePosStore.getState().mesas.some((m) => m.id === mesa1.id)).toBe(true)
  })

  it('no borra una mesa unida con otra — ni la secundaria ni la principal', async () => {
    usePosStore.setState({ mesas: MESAS.map((m) => (m.id === 'mesa-2' ? { ...m, joined_to: 'mesa-1' } : m)) })
    const { result } = renderHook(() => useMesaAdmin())
    expect((await result.current.borrarMesa('mesa-2')).error).toMatch(/unida/)
    expect((await result.current.borrarMesa('mesa-1')).error).toMatch(/unida/)
    expect(usePosStore.getState().mesas).toHaveLength(MESAS.length)
  })
})
