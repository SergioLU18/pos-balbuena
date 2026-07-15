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
