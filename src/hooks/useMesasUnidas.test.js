import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMesasUnidas } from './useMesasUnidas'
import { buildDraftItem } from './useOrderDraft'
import { useOrderStore, usePedidosStore, usePosStore, useAvisosStore } from '../store/appStore'
import { MENU } from '../lib/mockMenu'
import { MESAS } from '../lib/mockMesas'
import { MESEROS, ASIGNACIONES } from '../lib/mockMeseros'

const sope = MENU.find((p) => p.id === 'sope')
const mesa = (id) => usePosStore.getState().mesas.find((m) => m.id === id)

beforeEach(() => {
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS, asignaciones: ASIGNACIONES })
  useOrderStore.setState({ drafts: {}, cuentas: {} })
  usePedidosStore.setState({ pedidos: [] })
  useAvisosStore.setState({ avisos: [] })
})

describe('useMesasUnidas — unir', () => {
  it('apunta las secundarias a la principal', async () => {
    const { result } = renderHook(() => useMesasUnidas())
    let res
    await act(async () => { res = await result.current.unirMesas('mesa-3', ['mesa-4', 'mesa-5']) })
    expect(res.error).toBeNull()
    expect(mesa('mesa-4').joined_to).toBe('mesa-3')
    expect(mesa('mesa-5').joined_to).toBe('mesa-3')
    expect(mesa('mesa-3').joined_to ?? null).toBeNull()
  })

  it('pasa a la principal la cuenta, las comandas y el draft de la secundaria', async () => {
    const enviado = buildDraftItem(sope, 0)
    const sinEnviar = buildDraftItem(sope, 1)
    useOrderStore.setState({
      cuentas: { 'mesa-4': { items: [enviado], createdAt: '2026-09-11T20:00:00Z' } },
      drafts: { 'mesa-4': [sinEnviar] },
    })
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: 'mesa-4', mesaNumero: '4', items: [enviado], estado: 'pendiente' }],
    })

    const { result } = renderHook(() => useMesasUnidas())
    await act(async () => { await result.current.unirMesas('mesa-3', ['mesa-4']) })

    const { cuentas, drafts } = useOrderStore.getState()
    expect(cuentas['mesa-4']).toBeUndefined()
    expect(cuentas['mesa-3'].items).toEqual([enviado])
    expect(drafts['mesa-3']).toEqual([sinEnviar])
    expect(usePedidosStore.getState().pedidos[0].mesaId).toBe('mesa-3')
  })

  it('no hace cadenas: una mesa ya unida no se vuelve a unir, y avisa en la campana', async () => {
    usePosStore.setState({ mesas: MESAS.map((m) => (m.id === 'mesa-4' ? { ...m, joined_to: 'mesa-3' } : m)) })
    const { result } = renderHook(() => useMesasUnidas())
    let res
    await act(async () => { res = await result.current.unirMesas('mesa-6', ['mesa-4']) })
    expect(res.error).toBeTruthy()
    expect(mesa('mesa-4').joined_to).toBe('mesa-3')
    expect(useAvisosStore.getState().avisos).toHaveLength(1)
  })
})

describe('useMesasUnidas — separar', () => {
  it('suelta la mesa y deja lo pedido en la cuenta de la principal', async () => {
    const item = buildDraftItem(sope, 0)
    usePosStore.setState({ mesas: MESAS.map((m) => (m.id === 'mesa-4' ? { ...m, joined_to: 'mesa-3' } : m)) })
    useOrderStore.setState({ cuentas: { 'mesa-3': { items: [item], createdAt: '2026-09-11T20:00:00Z' } } })

    const { result } = renderHook(() => useMesasUnidas())
    await act(async () => { await result.current.separarMesa('mesa-4') })

    expect(mesa('mesa-4').joined_to).toBeNull()
    expect(useOrderStore.getState().cuentas['mesa-3'].items).toEqual([item])
    expect(useOrderStore.getState().cuentas['mesa-4']).toBeUndefined()
  })
})
