import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMesaAdmin } from './useMesaAdmin'
import { useOrderStore, usePosStore } from '../store/appStore'
import { meserosDeMesa } from '../lib/asignaciones'
import { MESAS } from '../lib/mockMesas'
import { MESEROS, ASIGNACIONES } from '../lib/mockMeseros'

beforeEach(() => {
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS, asignaciones: ASIGNACIONES })
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

  it('pone a atender la mesa nueva a TODOS los meseros indicados', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    await act(async () => {
      await result.current.crearMesa('16', [MESEROS[0].id, MESEROS[1].id])
    })
    const { mesas, asignaciones } = usePosStore.getState()
    const nueva = mesas.find((m) => m.numero === '16')
    expect(meserosDeMesa(asignaciones, nueva.id)).toEqual([MESEROS[0].id, MESEROS[1].id])
  })

  it('deja la mesa nueva sin nadie cuando no se indica mesero', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    await act(async () => {
      await result.current.crearMesa('16', [])
    })
    const { mesas, asignaciones } = usePosStore.getState()
    const nueva = mesas.find((m) => m.numero === '16')
    expect(meserosDeMesa(asignaciones, nueva.id)).toEqual([])
  })
})

describe('useMesaAdmin — borrar mesa', () => {
  it('quita la mesa del catálogo y la suelta de TODOS los meseros que la atendían', async () => {
    // mesa-5 arranca compartida entre Doña Rosa y Don Beto, así que el borrado tiene
    // que soltar a los dos y no solo al primero que la tuviera.
    const compartida = MESAS[4]
    expect(meserosDeMesa(ASIGNACIONES, compartida.id)).toHaveLength(2)

    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.borrarMesa(compartida.id)
    expect(error).toBeNull()
    expect(usePosStore.getState().mesas.some((m) => m.id === compartida.id)).toBe(false)
    expect(meserosDeMesa(usePosStore.getState().asignaciones, compartida.id)).toEqual([])
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
