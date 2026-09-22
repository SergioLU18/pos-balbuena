import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('../lib/sonidos', () => ({
  sonarListo: vi.fn(),
  sonarError: vi.fn(),
  sonarConfirmacion: vi.fn(),
  desbloquearAudio: vi.fn(),
}))

import { useAvisoListo } from './useAvisoListo'
import { sonarListo } from '../lib/sonidos'
import { usePedidosStore, useMeseroStore, usePosStore, useAvisosStore } from '../store/appStore'
import { MESAS } from '../lib/mockMesas'
import { MESEROS } from '../lib/mockMeseros'

const [ROSA, BETO, LUPITA] = MESEROS
const MESA = MESAS[4]

// El aviso sale a los 5 minutos de mandar el pedido (AVISO_MS en useAvisoListo). El
// envío se fecha apenas pasados esos 5 minutos para que suene al montar —dentro de la
// ventana de RECIENTE_MS— sin esperar al temporizador. Cada prueba usa un id distinto:
// useAvisoListo recuerda a nivel de módulo qué pedidos ya anunció.
const AVISO_MS = 5 * 60 * 1000
function pedidoVencido(id, extra) {
  return {
    id,
    mesaId: MESA.id,
    mesaNumero: MESA.numero,
    items: [],
    enviadoAt: new Date(Date.now() - AVISO_MS - 1000).toISOString(),
    estado: 'pendiente',
    ...extra,
  }
}

// Monta el hook como el mesero indicado y responde si sonó la campana.
function sonoPara(meseroId, pedido) {
  sonarListo.mockClear()
  useMeseroStore.setState({ currentMeseroId: meseroId })
  usePedidosStore.setState({ pedidos: [pedido] })
  renderHook(() => useAvisoListo())
  return sonarListo.mock.calls.length > 0
}

beforeEach(() => {
  vi.clearAllMocks()
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS })
  usePedidosStore.setState({ pedidos: [] })
  useAvisosStore.setState({ avisos: [] })
})

describe('useAvisoListo — a quién le suena', () => {
  it('suena para el mesero que MANDÓ el pedido', () => {
    expect(sonoPara(ROSA.id, pedidoVencido('p-propio', { meseroId: ROSA.id, meseroNombre: ROSA.nombre }))).toBe(true)
  })

  it('NO suena para otro mesero', () => {
    expect(sonoPara(BETO.id, pedidoVencido('p-ajeno', { meseroId: ROSA.id, meseroNombre: ROSA.nombre }))).toBe(false)
  })

  it('deja el aviso en la campana, no solo el sonido', () => {
    sonoPara(ROSA.id, pedidoVencido('p-aviso', { meseroId: ROSA.id, meseroNombre: ROSA.nombre }))
    const avisos = useAvisosStore.getState().avisos
    expect(avisos).toHaveLength(1)
    expect(avisos[0].mesaId).toBe(MESA.id)
  })

  it('no suena antes de los 5 minutos', () => {
    const recien = pedidoVencido('p-recien', { meseroId: ROSA.id, enviadoAt: new Date().toISOString() })
    expect(sonoPara(ROSA.id, recien)).toBe(false)
  })
})

describe('useAvisoListo — pedidos sin mesero_id (base anterior a la FK)', () => {
  it('cae al nombre para identificar al dueño', () => {
    expect(sonoPara(ROSA.id, pedidoVencido('p-nombre-mio', { meseroNombre: ROSA.nombre }))).toBe(true)
    expect(sonoPara(BETO.id, pedidoVencido('p-nombre-ajeno', { meseroNombre: ROSA.nombre }))).toBe(false)
  })

  it('si el pedido no tiene dueño reconocible, suena para todos', () => {
    // Más vale avisar de más que dejar un plato enfriándose sin dueño.
    expect(sonoPara(BETO.id, pedidoVencido('p-huerfano-1', { meseroNombre: '—' }))).toBe(true)
    expect(sonoPara(LUPITA.id, pedidoVencido('p-huerfano-2', { meseroNombre: '—' }))).toBe(true)
  })
})
