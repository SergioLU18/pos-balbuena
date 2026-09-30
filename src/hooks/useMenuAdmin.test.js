import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMenuAdmin } from './useMenuAdmin'
import { usePosStore } from '../store/appStore'
import { MENU } from '../test/fixtures/menu'
import { MESEROS } from '../test/fixtures/meseros'
import { RESTAURANTE_ID, responderRpc, llamadasRpc } from '../test/sbFalso'

// Firma que setup.js deja en sesión (el primer mesero).
const FIRMA = { p_mesero_id: MESEROS[0].id, p_mesero_nombre: MESEROS[0].nombre }

// El hook no toca el store: todo va por RPC y usePosData recarga por Realtime.
// Por eso aquí se revisa qué se mandó al backend, no cómo quedó el catálogo.

describe('useMenuAdmin — platillos', () => {
  it('crea un platillo nuevo: p_id null, campos normalizados y firma', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const antes = usePosStore.getState().platillos
    let res
    await act(async () => {
      res = await result.current.guardarPlatillo({
        nombre: '  Gordita ', categoria: 'Gorditas', base: 'Masa',
        tiers: [{ nombre: 'Sencillo', ingredientes: 0, precio: 90 }],
        permiteNota: true, activo: true,
      })
    })
    expect(res).toEqual({ error: null })
    const [params] = llamadasRpc('pos_guardar_platillo')
    expect(params).toEqual({
      p_id: null,
      p_restaurante_id: RESTAURANTE_ID,
      p_nombre: 'Gordita',
      p_categoria: 'Gorditas',
      p_base: 'Masa',
      p_tiers: [{ nombre: 'Sencillo', ingredientes: 0, precio: 90 }],
      p_permite_mitades: false,
      p_permite_nota: true,
      p_activo: true,
      p_tortillas: null,
      p_modificadores: [],
      p_extras: [],
      p_orden: null,
      p_tiempo_prep_min: 5,
      ...FIRMA,
    })
    // Sin cambio local: el platillo llega después por Realtime.
    expect(usePosStore.getState().platillos).toBe(antes)
  })

  it('edita un platillo existente mandando su id', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const objetivo = MENU[0]
    await act(async () => {
      await result.current.guardarPlatillo({ ...objetivo, nombre: 'Sope Especial', tiempoPrepMin: '8' })
    })
    const [params] = llamadasRpc('pos_guardar_platillo')
    expect(params).toMatchObject({ p_id: objetivo.id, p_nombre: 'Sope Especial', p_tiempo_prep_min: 8 })
  })

  it('borra un platillo por RPC con firma', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const objetivo = MENU[0]
    await act(async () => {
      await result.current.borrarPlatillo(objetivo.id)
    })
    expect(llamadasRpc('pos_borrar_platillo')).toEqual([{ p_id: objetivo.id, ...FIRMA }])
  })

  it('desactivar un platillo manda p_activo false', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    await act(async () => {
      await result.current.guardarPlatillo({ ...MENU[1], activo: false })
    })
    expect(llamadasRpc('pos_guardar_platillo')[0].p_activo).toBe(false)
  })

  it('regresa el mensaje de error del backend', async () => {
    responderRpc('pos_guardar_platillo', { error: { message: 'boom' } })
    const { result } = renderHook(() => useMenuAdmin())
    let res
    await act(async () => {
      res = await result.current.guardarPlatillo({ nombre: 'Gordita', tiers: [] })
    })
    expect(res).toEqual({ error: 'boom' })
  })
})

describe('useMenuAdmin — ingredientes, modificadores y extras', () => {
  it('crea y borra un ingrediente', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    await act(async () => {
      await result.current.guardarIngrediente({ nombre: 'Longaniza', extra: '20', activo: true })
    })
    expect(llamadasRpc('pos_guardar_ingrediente')).toEqual([{
      p_id: null, p_restaurante_id: RESTAURANTE_ID, p_nombre: 'Longaniza',
      p_extra: 20, p_activo: true, p_orden: null, ...FIRMA,
    }])
    await act(async () => {
      await result.current.borrarIngrediente('ing-0')
    })
    expect(llamadasRpc('pos_borrar_ingrediente')).toEqual([{ p_id: 'ing-0', ...FIRMA }])
  })

  it('asignarExtraAProductos manda los platillos seleccionados sin nombre viejo', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const refresco = usePosStore.getState().platillos.find((p) => p.nombre === 'Refresco')
    await act(async () => {
      await result.current.asignarExtraAProductos('Crema', [refresco.id])
    })
    expect(llamadasRpc('pos_set_extra_en_platillos')).toEqual([{
      p_restaurante_id: RESTAURANTE_ID, p_extra: 'Crema', p_platillo_ids: [refresco.id], p_old_extra: null, ...FIRMA,
    }])
  })

  it('asignarExtraAProductos con renombre manda el nombre viejo (y no si es el mismo)', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const sope = usePosStore.getState().platillos.find((p) => p.categoria === 'Sopes')
    await act(async () => {
      await result.current.asignarExtraAProductos('Crema Espesa', [sope.id], 'Crema')
      await result.current.asignarExtraAProductos('Crema', [sope.id], 'Crema')
    })
    const [renombre, igual] = llamadasRpc('pos_set_extra_en_platillos')
    expect(renombre).toMatchObject({ p_extra: 'Crema Espesa', p_old_extra: 'Crema' })
    expect(igual.p_old_extra).toBeNull()
  })

  it('desactivar un modificador manda p_activo false', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const objetivo = usePosStore.getState().modificadores[0]
    await act(async () => {
      await result.current.guardarModificador({ ...objetivo, activo: false })
    })
    expect(llamadasRpc('pos_guardar_modificador')).toEqual([{
      p_id: objetivo.id, p_restaurante_id: RESTAURANTE_ID, p_nombre: objetivo.nombre,
      p_activo: false, p_orden: objetivo.orden, ...FIRMA,
    }])
  })

  it('crea un extra con precio numérico', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    await act(async () => {
      await result.current.guardarExtra({ nombre: 'Doble Crema', precio: '12', activo: true })
    })
    expect(llamadasRpc('pos_guardar_extra')[0]).toMatchObject({
      p_id: null, p_restaurante_id: RESTAURANTE_ID, p_nombre: 'Doble Crema', p_precio: 12, p_activo: true,
    })
  })

  it('borra un extra y propaga el error del backend', async () => {
    responderRpc('pos_borrar_extra', { error: { message: 'en uso' } })
    const { result } = renderHook(() => useMenuAdmin())
    const objetivo = usePosStore.getState().extras[0]
    let res
    await act(async () => {
      res = await result.current.borrarExtra(objetivo.id)
    })
    expect(llamadasRpc('pos_borrar_extra')).toEqual([{ p_id: objetivo.id, ...FIRMA }])
    expect(res).toEqual({ error: 'en uso' })
  })
})

describe('useMenuAdmin — orden', () => {
  it('reordenarCategorias manda los nombres en el orden nuevo', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    const orden = usePosStore.getState().categoriasOrden.map((c) => c.nombre)
    const nuevo = ['Postres', ...orden.filter((n) => n !== 'Postres')]
    await act(async () => {
      await result.current.reordenarCategorias(nuevo)
    })
    expect(llamadasRpc('pos_reordenar_categorias')).toEqual([{ p_restaurante_id: RESTAURANTE_ID, p_nombres: nuevo, ...FIRMA }])
  })

  it('reordenarPlatillos, reordenarModificadores y reordenarExtras mandan los ids en orden', async () => {
    const { result } = renderHook(() => useMenuAdmin())
    await act(async () => {
      await result.current.reordenarPlatillos(['sope2', MENU[0].id])
      await result.current.reordenarModificadores(['mod-1', 'mod-0'])
      await result.current.reordenarExtras(['ext-1', 'ext-0'])
    })
    expect(llamadasRpc('pos_reordenar_platillos')).toEqual([{ p_ids: ['sope2', MENU[0].id], ...FIRMA }])
    expect(llamadasRpc('pos_reordenar_modificadores')).toEqual([{ p_ids: ['mod-1', 'mod-0'], ...FIRMA }])
    expect(llamadasRpc('pos_reordenar_extras')).toEqual([{ p_ids: ['ext-1', 'ext-0'], ...FIRMA }])
  })
})
