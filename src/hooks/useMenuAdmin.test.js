import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMenuAdmin } from './useMenuAdmin'
import { useMenu } from './useMenu'
import { usePosStore } from '../store/appStore'
import { MENU, INGREDIENTES, MODIFICADORES, EXTRAS } from '../lib/mockMenu'

beforeEach(() => {
  usePosStore.setState({
    platillos: MENU.map((p) => ({ activo: true, ...p })),
    ingredientes: INGREDIENTES.map((x, i) => ({ id: `ing-${i}`, activo: true, orden: i, ...x })),
    modificadores: MODIFICADORES.map((nombre, i) => ({ id: `mod-${i}`, nombre, activo: true, orden: i })),
    extras: EXTRAS.map((x, i) => ({ id: `ext-${i}`, activo: true, orden: i, ...x })),
  })
})

describe('useMenuAdmin — platillos', () => {
  it('crea un platillo nuevo con id generado', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    await act(async () => {
      await result.current.guardarPlatillo({
        nombre: 'Gordita', categoria: 'Gorditas', base: 'Masa',
        tiers: [{ nombre: 'Sencillo', ingredientes: 0, precio: 90 }],
        permiteMitades: false, permiteNota: true, activo: true,
      })
    })
    const nuevo = usePosStore.getState().platillos.find((p) => p.nombre === 'Gordita')
    expect(nuevo).toBeTruthy()
    expect(nuevo.tiers[0].precio).toBe(90)
  })

  it('edita un platillo existente sin duplicarlo', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const objetivo = MENU[0]
    const antes = usePosStore.getState().platillos.length
    await act(async () => {
      await result.current.guardarPlatillo({ ...objetivo, nombre: 'Sope Especial' })
    })
    const platillos = usePosStore.getState().platillos
    expect(platillos).toHaveLength(antes)
    expect(platillos.find((p) => p.id === objetivo.id).nombre).toBe('Sope Especial')
  })

  it('borra un platillo y deja de aparecer en useMenu', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const objetivo = MENU[0]
    await act(async () => {
      await result.current.borrarPlatillo(objetivo.id)
    })
    expect(usePosStore.getState().platillos.some((p) => p.id === objetivo.id)).toBe(false)
    const { result: menuRes } = renderHook(() => useMenu())
    expect(menuRes.current.menu.some((p) => p.id === objetivo.id)).toBe(false)
  })

  it('un platillo inactivo no aparece en el menú del mesero', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const objetivo = MENU[1]
    await act(async () => {
      await result.current.guardarPlatillo({ ...objetivo, activo: false })
    })
    const { result: menuRes } = renderHook(() => useMenu())
    expect(menuRes.current.menu.some((p) => p.id === objetivo.id)).toBe(false)
  })
})

describe('useMenuAdmin — ingredientes y modificadores', () => {
  it('crea y borra un ingrediente', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    await act(async () => {
      await result.current.guardarIngrediente({ nombre: 'Longaniza', extra: 20, activo: true })
    })
    let creado = usePosStore.getState().ingredientes.find((i) => i.nombre === 'Longaniza')
    expect(creado.extra).toBe(20)
    await act(async () => {
      await result.current.borrarIngrediente(creado.id)
    })
    expect(usePosStore.getState().ingredientes.some((i) => i.id === creado.id)).toBe(false)
  })

  it('un modificador inactivo no llega al flujo de orden', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const objetivo = usePosStore.getState().modificadores[0]
    await act(async () => {
      await result.current.guardarModificador({ ...objetivo, activo: false })
    })
    const { result: menuRes } = renderHook(() => useMenu())
    expect(menuRes.current.modificadores).not.toContain(objetivo.nombre)
  })

  it('crea un extra con precio y aparece en useMenu', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    await act(async () => {
      await result.current.guardarExtra({ nombre: 'Doble Crema', precio: 12, activo: true })
    })
    const creado = usePosStore.getState().extras.find((e) => e.nombre === 'Doble Crema')
    expect(creado.precio).toBe(12)
    const { result: menuRes } = renderHook(() => useMenu())
    expect(menuRes.current.extras.some((e) => e.nombre === 'Doble Crema' && e.precio === 12)).toBe(true)
  })

  it('borra un extra', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const objetivo = usePosStore.getState().extras[0]
    await act(async () => {
      await result.current.borrarExtra(objetivo.id)
    })
    expect(usePosStore.getState().extras.some((e) => e.id === objetivo.id)).toBe(false)
  })
})
