import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMeseroAdmin } from './useMeseroAdmin'
import { usePosStore } from '../store/appStore'
import { MESEROS } from '../lib/mockMeseros'

beforeEach(() => {
  usePosStore.setState({ meseros: MESEROS.map((m) => ({ ...m })) })
})

describe('useMeseroAdmin — crear mesero', () => {
  it('agrega el mesero nuevo al catálogo con un id generado', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    await act(async () => {
      await result.current.guardarMesero({ nombre: 'Nuevo', mesas: ['16'], pin: '9999', esAdmin: false })
    })
    const meseros = usePosStore.getState().meseros
    const nuevo = meseros.find((m) => m.nombre === 'Nuevo')
    expect(nuevo).toBeTruthy()
    expect(nuevo.id).toBeTruthy()
    expect(nuevo.mesas).toEqual(['16'])
  })
})

describe('useMeseroAdmin — editar mesero', () => {
  it('actualiza los campos del mesero existente sin crear otro', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    const objetivo = MESEROS[1]
    await act(async () => {
      await result.current.guardarMesero({ id: objetivo.id, nombre: 'Beto Editado', mesas: [], pin: '2222', esAdmin: true })
    })
    const meseros = usePosStore.getState().meseros
    expect(meseros).toHaveLength(MESEROS.length)
    const editado = meseros.find((m) => m.id === objetivo.id)
    expect(editado.nombre).toBe('Beto Editado')
    expect(editado.esAdmin).toBe(true)
  })
})

describe('useMeseroAdmin — borrar mesero', () => {
  it('quita al mesero del catálogo', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    const objetivo = MESEROS[2]
    const { error } = await result.current.borrarMesero(objetivo.id)
    expect(error).toBeNull()
    expect(usePosStore.getState().meseros.some((m) => m.id === objetivo.id)).toBe(false)
  })
})
