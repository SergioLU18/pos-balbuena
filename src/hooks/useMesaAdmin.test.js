import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMesaAdmin } from './useMesaAdmin'
import { MESAS } from '../test/fixtures/mesas'
import { MESEROS } from '../test/fixtures/meseros'
import { RESTAURANTE_ID, responderRpc, llamadasRpc } from '../test/sbFalso'

// Firma del mesero en sesión (setup.js deja al primero).
const FIRMA = { p_mesero_id: MESEROS[0].id, p_mesero_nombre: MESEROS[0].nombre }

describe('useMesaAdmin — crear mesa', () => {
  it('manda pos_crear_mesa con el nombre recortado y devuelve el id nuevo', async () => {
    responderRpc('pos_crear_mesa', { data: 'mesa-nueva' })
    const { result } = renderHook(() => useMesaAdmin())
    let res
    await act(async () => {
      res = await result.current.crearMesa('  16  ')
    })
    expect(res).toEqual({ error: null, id: 'mesa-nueva' })
    expect(llamadasRpc('pos_crear_mesa')).toEqual([{ p_restaurante_id: RESTAURANTE_ID, p_numero: '16', ...FIRMA }])
  })

  it('devuelve el error del servidor y ningún id', async () => {
    responderRpc('pos_crear_mesa', { error: { message: 'boom' } })
    const { result } = renderHook(() => useMesaAdmin())
    expect(await result.current.crearMesa('16')).toEqual({ error: 'boom', id: null })
  })

  it('no manda nada si el nombre está vacío', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    const { error, id } = await result.current.crearMesa('   ')
    expect(error).toMatch(/[Ee]scribe un nombre/)
    expect(id).toBeNull()
    expect(llamadasRpc('pos_crear_mesa')).toHaveLength(0)
  })
})

describe('useMesaAdmin — nombre único', () => {
  it('no crea una mesa con un nombre que ya existe (sin distinguir mayúsculas)', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.crearMesa(MESAS[0].numero.toUpperCase())
    expect(error).toMatch(/[Yy]a existe/)
    expect(llamadasRpc('pos_crear_mesa')).toHaveLength(0)
  })
})

describe('useMesaAdmin — renombrar mesa', () => {
  it('manda pos_renombrar_mesa con el nombre nuevo', async () => {
    const mesa = MESAS[0]
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.renombrarMesa(mesa.id, ' Terraza 1 ')
    expect(error).toBeNull()
    expect(llamadasRpc('pos_renombrar_mesa')).toEqual([{ p_mesa_id: mesa.id, p_numero: 'Terraza 1', ...FIRMA }])
  })

  it('permite dejarle a la mesa su propio nombre (no cuenta como duplicado)', async () => {
    const mesa = MESAS[0]
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.renombrarMesa(mesa.id, mesa.numero)
    expect(error).toBeNull()
    expect(llamadasRpc('pos_renombrar_mesa')).toHaveLength(1)
  })

  it('no permite renombrar a un nombre que ya usa otra mesa', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.renombrarMesa(MESAS[0].id, MESAS[1].numero)
    expect(error).toMatch(/[Yy]a existe/)
    expect(llamadasRpc('pos_renombrar_mesa')).toHaveLength(0)
  })

  it('devuelve el error del servidor', async () => {
    responderRpc('pos_renombrar_mesa', { error: { message: 'boom' } })
    const { result } = renderHook(() => useMesaAdmin())
    expect(await result.current.renombrarMesa(MESAS[0].id, 'Terraza 1')).toEqual({ error: 'boom' })
  })
})

describe('useMesaAdmin — reordenar mesas', () => {
  it('manda pos_reordenar_mesas con los ids en el orden recibido', async () => {
    const { result } = renderHook(() => useMesaAdmin())
    const invertido = [...MESAS].reverse().map((m) => m.id)
    const { error } = await result.current.reordenarMesas(invertido)
    expect(error).toBeNull()
    expect(llamadasRpc('pos_reordenar_mesas')).toEqual([{ p_ids: invertido, ...FIRMA }])
  })
})

describe('useMesaAdmin — borrar mesa', () => {
  it('manda pos_borrar_mesa con la mesa y la firma', async () => {
    const mesa = MESAS[4]
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.borrarMesa(mesa.id)
    expect(error).toBeNull()
    expect(llamadasRpc('pos_borrar_mesa')).toEqual([{ p_mesa_id: mesa.id, ...FIRMA }])
  })

  it('devuelve el error del servidor cuando la mesa tiene cuenta abierta', async () => {
    // La regla vive en pos_borrar_mesa; el hook solo debe dejar pasar el mensaje.
    responderRpc('pos_borrar_mesa', { error: { message: 'La mesa tiene una cuenta abierta.' } })
    const { result } = renderHook(() => useMesaAdmin())
    const { error } = await result.current.borrarMesa(MESAS[0].id)
    expect(error).toMatch(/cuenta abierta/)
  })
})
