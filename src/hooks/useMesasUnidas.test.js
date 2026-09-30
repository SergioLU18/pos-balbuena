import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMesasUnidas } from './useMesasUnidas'
import { buildDraftItem } from './useOrderDraft'
import { useOrderStore, usePosStore, useAvisosStore } from '../store/appStore'
import { responderRpc, llamadasRpc } from '../test/sbFalso'
import { MENU } from '../test/fixtures/menu'
import { MESAS } from '../test/fixtures/mesas'
import { MESEROS } from '../test/fixtures/meseros'

const sope = MENU.find((p) => p.id === 'sope')
const firmaEsperada = { p_mesero_id: MESEROS[0].id, p_mesero_nombre: MESEROS[0].nombre }

beforeEach(() => {
  useOrderStore.setState({ drafts: {}, cuentas: {} })
  useAvisosStore.setState({ avisos: [] })
})

describe('useMesasUnidas — unir', () => {
  it('manda pos_unir_mesas con la principal, las secundarias sin repetir y la firma', async () => {
    const { result } = renderHook(() => useMesasUnidas())
    let res
    await act(async () => { res = await result.current.unirMesas('mesa-3', ['mesa-4', 'mesa-5', 'mesa-4']) })
    expect(res.error).toBeNull()
    expect(llamadasRpc('pos_unir_mesas')).toEqual([
      { p_principal_id: 'mesa-3', p_secundarias: ['mesa-4', 'mesa-5'], ...firmaEsperada },
    ])
  })

  it('pasa a la principal el draft sin enviar de la secundaria (la cuenta y las comandas las mueve el backend)', async () => {
    const yaEnPrincipal = buildDraftItem(sope, 0)
    const sinEnviar = buildDraftItem(sope, 1)
    useOrderStore.setState({ drafts: { 'mesa-3': [yaEnPrincipal], 'mesa-4': [sinEnviar] } })

    const { result } = renderHook(() => useMesasUnidas())
    await act(async () => { await result.current.unirMesas('mesa-3', ['mesa-4']) })

    const { drafts } = useOrderStore.getState()
    expect(drafts['mesa-3']).toEqual([yaEnPrincipal, sinEnviar])
    expect(drafts['mesa-4']).toBeUndefined()
  })

  it('si el backend rechaza la unión, no mueve el draft, devuelve el error y avisa en la campana', async () => {
    // Las reglas (sin cadenas, sin mesas dadas de baja...) las valida pos_unir_mesas.
    responderRpc('pos_unir_mesas', { error: { message: 'boom' } })
    const sinEnviar = buildDraftItem(sope, 1)
    useOrderStore.setState({ drafts: { 'mesa-4': [sinEnviar] } })

    const { result } = renderHook(() => useMesasUnidas())
    let res
    await act(async () => { res = await result.current.unirMesas('mesa-6', ['mesa-4']) })

    expect(res.error).toBe('boom')
    expect(useOrderStore.getState().drafts['mesa-4']).toEqual([sinEnviar])
    expect(useOrderStore.getState().drafts['mesa-6']).toBeUndefined()
    const avisos = useAvisosStore.getState().avisos
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatchObject({ tipo: 'error', detalle: 'boom' })
    expect(avisos[0].titulo).toContain('Mesa 6')
  })

  it('sin secundarias no llama al backend', async () => {
    const { result } = renderHook(() => useMesasUnidas())
    let res
    await act(async () => { res = await result.current.unirMesas('mesa-3', []) })
    expect(res.error).toBeTruthy()
    expect(llamadasRpc('pos_unir_mesas')).toHaveLength(0)
  })
})

describe('useMesasUnidas — separar', () => {
  const conLa4Unida = () => usePosStore.setState({ mesas: MESAS.map((m) => (m.id === 'mesa-4' ? { ...m, joined_to: 'mesa-3' } : m)) })

  it('manda pos_separar_mesa con la secundaria y la firma', async () => {
    conLa4Unida()
    const { result } = renderHook(() => useMesasUnidas())
    let res
    await act(async () => { res = await result.current.separarMesa('mesa-4') })
    expect(res.error).toBeNull()
    expect(llamadasRpc('pos_separar_mesa')).toEqual([{ p_mesa_id: 'mesa-4', ...firmaEsperada }])
  })

  it('una mesa que no está unida no llama al backend', async () => {
    const { result } = renderHook(() => useMesasUnidas())
    let res
    await act(async () => { res = await result.current.separarMesa('mesa-4') })
    expect(res.error).toBeNull()
    expect(llamadasRpc('pos_separar_mesa')).toHaveLength(0)
  })

  it('si el backend falla, devuelve el error y avisa en la campana', async () => {
    conLa4Unida()
    responderRpc('pos_separar_mesa', { error: { message: 'boom' } })
    const { result } = renderHook(() => useMesasUnidas())
    let res
    await act(async () => { res = await result.current.separarMesa('mesa-4') })
    expect(res.error).toBe('boom')
    const avisos = useAvisosStore.getState().avisos
    expect(avisos).toHaveLength(1)
    expect(avisos[0].titulo).toContain('Mesa 4')
  })
})
