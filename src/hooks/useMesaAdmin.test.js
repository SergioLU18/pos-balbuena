import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMesaAdmin } from './useMesaAdmin'
import { useOrderStore, usePosStore } from '../store/appStore'
import { MESAS } from '../lib/mockMesas'
import { MESEROS } from '../lib/mockMeseros'

beforeEach(() => {
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS })
  useOrderStore.setState({ drafts: {}, cuentas: {} })
})

describe('useMesaAdmin — crear mesa', () => {
  it('agrega la mesa nueva al catálogo', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    await act(async () => {
      await result.current.crearMesa('16', null)
    })
    const mesas = usePosStore.getState().mesas
    expect(mesas.some((m) => m.numero === '16')).toBe(true)
  })

  it('asigna la mesa nueva al mesero indicado', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    await act(async () => {
      await result.current.crearMesa('16', MESEROS[0].id)
    })
    const mesero = usePosStore.getState().meseros.find((m) => m.id === MESEROS[0].id)
    expect(mesero.mesas).toContain('16')
  })
})

describe('useMesaAdmin — nombre único', () => {
  it('no crea una mesa con un nombre que ya existe (sin distinguir mayúsculas)', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.crearMesa(MESAS[0].numero.toUpperCase(), null)
    expect(error).toMatch(/[Yy]a existe/)
    expect(usePosStore.getState().mesas.length).toBe(MESAS.length)
  })

  it('rechaza el prefijo reservado "PL-"', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.crearMesa('PL-9', null)
    expect(error).toMatch(/PL-/)
  })
})

describe('useMesaAdmin — renombrar mesa', () => {
  it('cambia el nombre y lo propaga a los meseros que la tenían asignada', async () => {
    const mesa = MESAS[0]
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.renombrarMesa(mesa.id, 'Terraza 1')
    expect(error).toBeNull()
    expect(usePosStore.getState().mesas.find((m) => m.id === mesa.id).numero).toBe('Terraza 1')
    const teniaLaMesa = MESEROS.some((m) => m.mesas.includes(mesa.numero))
    if (teniaLaMesa) {
      expect(usePosStore.getState().meseros.some((m) => m.mesas.includes('Terraza 1'))).toBe(true)
      expect(usePosStore.getState().meseros.some((m) => m.mesas.includes(mesa.numero))).toBe(false)
    }
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
  it('quita la mesa del catálogo y de cualquier mesero que la tuviera asignada', async () => {
    const mesa1 = MESAS[0]
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.borrarMesa(mesa1.id)
    expect(error).toBeNull()
    expect(usePosStore.getState().mesas.some((m) => m.id === mesa1.id)).toBe(false)
    expect(usePosStore.getState().meseros.some((m) => m.mesas.includes(mesa1.numero))).toBe(false)
  })

  it('no borra una mesa con cuenta abierta y devuelve un error', async () => {
    const mesa1 = MESAS[0]
    useOrderStore.setState({ cuentas: { [mesa1.id]: { items: [], createdAt: new Date().toISOString() } } })
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.borrarMesa(mesa1.id)
    expect(error).toMatch(/cuenta abierta/)
    expect(usePosStore.getState().mesas.some((m) => m.id === mesa1.id)).toBe(true)
  })
})
