import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMeseroAdmin } from './useMeseroAdmin'
import { usePosStore } from '../store/appStore'
import { mesasDeMesero } from '../lib/asignaciones'
import { MESAS } from '../lib/mockMesas'
import { MESEROS, ASIGNACIONES } from '../lib/mockMeseros'

beforeEach(() => {
  usePosStore.setState({
    meseros: MESEROS.map((m) => ({ ...m })),
    mesas: MESAS,
    asignaciones: ASIGNACIONES,
  })
})

describe('useMeseroAdmin — crear mesero', () => {
  it('agrega el mesero nuevo al catálogo con un id generado', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    await act(async () => {
      await result.current.guardarMesero({ nombre: 'Nuevo', pin: '9999', esAdmin: false })
    })
    const { meseros, asignaciones } = usePosStore.getState()
    const nuevo = meseros.find((m) => m.nombre === 'Nuevo')
    expect(nuevo).toBeTruthy()
    expect(nuevo.id).toBeTruthy()
    // Ya no se le asignan mesas al crearlo: el alta no toca el reparto.
    expect(mesasDeMesero(asignaciones, nuevo.id)).toEqual([])
  })
})

describe('useMeseroAdmin — editar mesero', () => {
  it('actualiza los campos del mesero existente sin crear otro ni tocar su reparto de mesas', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    const objetivo = MESEROS[1]
    await act(async () => {
      await result.current.guardarMesero({ id: objetivo.id, nombre: 'Beto Editado', pin: '2222', esAdmin: true })
    })
    const { meseros, asignaciones } = usePosStore.getState()
    expect(meseros).toHaveLength(MESEROS.length)
    const editado = meseros.find((m) => m.id === objetivo.id)
    expect(editado.nombre).toBe('Beto Editado')
    expect(editado.esAdmin).toBe(true)
    // Editar ya no manda un reparto de mesas, así que el que ya tenía se queda igual.
    expect(mesasDeMesero(asignaciones, objetivo.id)).toEqual(mesasDeMesero(ASIGNACIONES, objetivo.id))
  })
})

describe('useMeseroAdmin — borrar mesero', () => {
  it('quita al mesero del catálogo', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    const objetivo = MESEROS[2]
    const { error } = await result.current.borrarMesero(objetivo.id)
    expect(error).toBeNull()
    const { meseros, asignaciones } = usePosStore.getState()
    expect(meseros.some((m) => m.id === objetivo.id)).toBe(false)
    // Y lo suelta de sus mesas: quien ya no está en el turno no puede seguir
    // figurando como quien las atiende.
    expect(mesasDeMesero(asignaciones, objetivo.id)).toEqual([])
  })
})
