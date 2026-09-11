import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMeseroAdmin } from './useMeseroAdmin'
import { usePosStore } from '../store/appStore'
import { mesasDeMesero, meserosDeMesa } from '../lib/asignaciones'
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
      await result.current.guardarMesero({ nombre: 'Nuevo', mesas: ['mesa-1'], pin: '9999', esAdmin: false })
    })
    const { meseros, asignaciones } = usePosStore.getState()
    const nuevo = meseros.find((m) => m.nombre === 'Nuevo')
    expect(nuevo).toBeTruthy()
    expect(nuevo.id).toBeTruthy()
    // El reparto NO se guarda dentro del mesero: vive en asignaciones, porque una
    // mesa puede tener varios meseros.
    expect(nuevo.mesas).toBeUndefined()
    expect(mesasDeMesero(asignaciones, nuevo.id)).toEqual(['mesa-1'])
  })

  it('darle una mesa a un mesero no se la quita a quien ya la atendía', async () => {
    const rosa = MESEROS[0] // atiende mesa-1
    const lupita = MESEROS[2]
    const { result } = renderHook(() => useMeseroAdmin())
    await act(async () => {
      await result.current.guardarMesero({
        id: lupita.id,
        nombre: lupita.nombre,
        pin: lupita.pin,
        esAdmin: false,
        mesas: [...mesasDeMesero(ASIGNACIONES, lupita.id), 'mesa-1'],
      })
    })
    const { asignaciones } = usePosStore.getState()
    expect(meserosDeMesa(asignaciones, 'mesa-1')).toEqual(
      expect.arrayContaining([rosa.id, lupita.id]),
    )
    // Y Rosa conserva el resto de su reparto intacto.
    expect(mesasDeMesero(asignaciones, rosa.id)).toEqual(mesasDeMesero(ASIGNACIONES, rosa.id))
  })
})

describe('useMeseroAdmin — editar mesero', () => {
  it('actualiza los campos del mesero existente sin crear otro', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    const objetivo = MESEROS[1]
    await act(async () => {
      await result.current.guardarMesero({ id: objetivo.id, nombre: 'Beto Editado', mesas: [], pin: '2222', esAdmin: true })
    })
    const { meseros, asignaciones } = usePosStore.getState()
    expect(meseros).toHaveLength(MESEROS.length)
    const editado = meseros.find((m) => m.id === objetivo.id)
    expect(editado.nombre).toBe('Beto Editado')
    expect(editado.esAdmin).toBe(true)
    // Guardar con la lista vacía lo deja sin mesas, pero sin tocar el reparto ajeno:
    // mesa-5, que compartía con Doña Rosa, sigue atendida por ella.
    expect(mesasDeMesero(asignaciones, objetivo.id)).toEqual([])
    expect(meserosDeMesa(asignaciones, 'mesa-5')).toEqual([MESEROS[0].id])
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
