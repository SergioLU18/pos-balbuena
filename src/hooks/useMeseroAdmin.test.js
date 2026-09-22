import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMeseroAdmin } from './useMeseroAdmin'
import { usePosStore } from '../store/appStore'
import { MESAS } from '../lib/mockMesas'
import { MESEROS } from '../lib/mockMeseros'

beforeEach(() => {
  usePosStore.setState({ meseros: MESEROS.map((m) => ({ ...m })), mesas: MESAS })
})

describe('useMeseroAdmin — crear mesero', () => {
  it('agrega el mesero nuevo al catálogo con un id generado', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    await act(async () => {
      await result.current.guardarMesero({ nombre: 'Nuevo', pin: '9999', esAdmin: false })
    })
    const nuevo = usePosStore.getState().meseros.find((m) => m.nombre === 'Nuevo')
    expect(nuevo).toBeTruthy()
    expect(nuevo.id).toBeTruthy()
    expect(nuevo.activo).toBe(true)
  })
})

describe('useMeseroAdmin — editar mesero', () => {
  it('actualiza los campos del mesero existente sin crear otro', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    const objetivo = MESEROS[1]
    await act(async () => {
      await result.current.guardarMesero({ id: objetivo.id, nombre: 'Beto Editado', pin: '2222', esAdmin: true })
    })
    const { meseros } = usePosStore.getState()
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
