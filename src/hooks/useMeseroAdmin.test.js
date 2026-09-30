import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMeseroAdmin } from './useMeseroAdmin'
import { MESEROS } from '../test/fixtures/meseros'
import { RESTAURANTE_ID, responderRpc, llamadasRpc } from '../test/sbFalso'

// Firma del admin en sesión (setup.js deja al primero). En las RPCs de meseros el
// actor va como p_actor_*, porque p_mesero_* es el mesero afectado.
const FIRMA = { p_actor_id: MESEROS[0].id, p_actor_nombre: MESEROS[0].nombre }

describe('useMeseroAdmin — crear mesero', () => {
  it('manda pos_guardar_mesero sin id y activo por omisión', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    let res
    await act(async () => {
      res = await result.current.guardarMesero({ nombre: '  Nuevo ', pin: '9999', esAdmin: false })
    })
    expect(res).toEqual({ error: null })
    expect(llamadasRpc('pos_guardar_mesero')).toEqual([
      {
        p_id: null,
        p_restaurante_id: RESTAURANTE_ID,
        p_nombre: 'Nuevo',
        p_pin: '9999',
        p_es_admin: false,
        p_activo: true,
        ...FIRMA,
      },
    ])
  })

  it('devuelve el error del servidor', async () => {
    responderRpc('pos_guardar_mesero', { error: { message: 'boom' } })
    const { result } = renderHook(() => useMeseroAdmin())
    expect(await result.current.guardarMesero({ nombre: 'Nuevo', pin: '9999' })).toEqual({ error: 'boom' })
  })
})

describe('useMeseroAdmin — editar mesero', () => {
  it('manda el id del mesero existente con los campos nuevos', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    const objetivo = MESEROS[1]
    await act(async () => {
      await result.current.guardarMesero({ id: objetivo.id, nombre: 'Beto Editado', pin: '2222', esAdmin: true })
    })
    const [params] = llamadasRpc('pos_guardar_mesero')
    expect(params).toMatchObject({ p_id: objetivo.id, p_nombre: 'Beto Editado', p_pin: '2222', p_es_admin: true, ...FIRMA })
  })

  it('manda p_pin null cuando el PIN viene vacío y respeta activo=false', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    await result.current.guardarMesero({ id: MESEROS[1].id, nombre: 'Don Beto', pin: '', activo: false })
    const [params] = llamadasRpc('pos_guardar_mesero')
    expect(params.p_pin).toBeNull()
    expect(params.p_activo).toBe(false)
  })
})

describe('useMeseroAdmin — borrar mesero', () => {
  it('manda pos_borrar_mesero con el mesero afectado y la firma del actor', async () => {
    const { result } = renderHook(() => useMeseroAdmin())
    const objetivo = MESEROS[2]
    const { error } = await result.current.borrarMesero(objetivo.id)
    expect(error).toBeNull()
    expect(llamadasRpc('pos_borrar_mesero')).toEqual([{ p_mesero_id: objetivo.id, ...FIRMA }])
  })
})
