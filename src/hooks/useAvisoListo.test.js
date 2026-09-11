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
import { MESEROS, ASIGNACIONES } from '../lib/mockMeseros'

const [ROSA, BETO, LUPITA] = MESEROS
const COMPARTIDA = MESAS[4] // mesa-5: la atienden Rosa y Beto

// El pedido acaba de quedar listo (dentro de la ventana de 2 min de RECIENTE_MS).
// Cada prueba usa un id distinto: useAvisoListo recuerda a nivel de módulo qué
// pedidos ya anunció, así que reusar un id haría que el segundo render no sonara.
function pedidoListo(id, extra) {
  return {
    id,
    mesaId: COMPARTIDA.id,
    mesaNumero: COMPARTIDA.numero,
    items: [],
    enviadoAt: new Date().toISOString(),
    estado: 'listo',
    listoAt: new Date().toISOString(),
    ...extra,
  }
}

// Monta el hook como el mesero indicado y responde si sonó la campana. Limpia el
// espía primero para poder encadenar varias llamadas dentro de una misma prueba.
function sonoPara(meseroId, pedido) {
  sonarListo.mockClear()
  useMeseroStore.setState({ currentMeseroId: meseroId })
  usePedidosStore.setState({ pedidos: [pedido] })
  renderHook(() => useAvisoListo())
  return sonarListo.mock.calls.length > 0
}

beforeEach(() => {
  vi.clearAllMocks()
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS, asignaciones: ASIGNACIONES })
  usePedidosStore.setState({ pedidos: [] })
  useAvisosStore.setState({ avisos: [] })
})

describe('useAvisoListo — a quién le suena en una mesa con varios meseros', () => {
  it('suena para el mesero que MANDÓ el pedido', () => {
    expect(sonoPara(ROSA.id, pedidoListo('p-propio', { meseroId: ROSA.id, meseroNombre: ROSA.nombre }))).toBe(true)
  })

  it('NO suena para el otro mesero de la misma mesa', () => {
    // Beto también atiende mesa-5, pero el plato no es de su comanda: antes le sonaba
    // igual y ninguno de los dos sabía a quién le tocaba ir por él.
    expect(sonoPara(BETO.id, pedidoListo('p-ajeno', { meseroId: ROSA.id, meseroNombre: ROSA.nombre }))).toBe(false)
  })

  it('NO suena para un mesero que ni atiende la mesa ni mandó el pedido', () => {
    expect(sonoPara(LUPITA.id, pedidoListo('p-lejano', { meseroId: ROSA.id, meseroNombre: ROSA.nombre }))).toBe(false)
  })

  it('deja el aviso en la campana, no solo el sonido', () => {
    sonoPara(ROSA.id, pedidoListo('p-aviso', { meseroId: ROSA.id, meseroNombre: ROSA.nombre }))
    const avisos = useAvisosStore.getState().avisos
    expect(avisos).toHaveLength(1)
    expect(avisos[0].mesaId).toBe(COMPARTIDA.id)
  })
})

describe('useAvisoListo — pedidos sin mesero_id (base anterior a la FK)', () => {
  it('cae al nombre para identificar al dueño', () => {
    expect(sonoPara(ROSA.id, pedidoListo('p-nombre-mio', { meseroNombre: ROSA.nombre }))).toBe(true)
    expect(sonoPara(BETO.id, pedidoListo('p-nombre-ajeno', { meseroNombre: ROSA.nombre }))).toBe(false)
  })

  it('si el pedido no tiene dueño reconocible, suena para todos los que atienden la mesa', () => {
    // Más vale avisar de más que dejar un plato enfriándose sin dueño.
    expect(sonoPara(BETO.id, pedidoListo('p-huerfano-1', { meseroNombre: '—' }))).toBe(true)
    expect(sonoPara(LUPITA.id, pedidoListo('p-huerfano-2', { meseroNombre: '—' }))).toBe(false)
  })
})
