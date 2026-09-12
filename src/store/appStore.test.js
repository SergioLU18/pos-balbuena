import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMesaPagadaStore } from './appStore'

describe('useMesaPagadaStore — el badge de "pagada" se apaga solo', () => {
  beforeEach(() => {
    useMesaPagadaStore.setState({ pagadas: {} })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('se limpia sola a los 3 minutos de marcarse', () => {
    useMesaPagadaStore.getState().marcarPagada('mesa-1', { at: new Date().toISOString(), total: 100 })
    expect(useMesaPagadaStore.getState().pagadas['mesa-1']).toBeTruthy()

    vi.advanceTimersByTime(3 * 60 * 1000)
    expect(useMesaPagadaStore.getState().pagadas['mesa-1']).toBeUndefined()
  })

  it('no reinicia su propio conteo si se vuelve a marcar la misma mesa antes de expirar', () => {
    useMesaPagadaStore.getState().marcarPagada('mesa-1', { at: new Date().toISOString(), total: 100 })
    vi.advanceTimersByTime(2 * 60 * 1000)
    useMesaPagadaStore.getState().marcarPagada('mesa-1', { at: new Date().toISOString(), total: 999 }) // no-op: ya estaba marcada

    vi.advanceTimersByTime(1 * 60 * 1000) // 3 min desde el primer marcado
    expect(useMesaPagadaStore.getState().pagadas['mesa-1']).toBeUndefined()
  })

  it('limpiarPagada la apaga antes de que expire el timeout (p. ej. al reabrir la mesa)', () => {
    useMesaPagadaStore.getState().marcarPagada('mesa-1', { at: new Date().toISOString(), total: 100 })
    useMesaPagadaStore.getState().limpiarPagada('mesa-1')
    expect(useMesaPagadaStore.getState().pagadas['mesa-1']).toBeUndefined()
  })
})
