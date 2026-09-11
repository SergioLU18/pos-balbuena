import { describe, it, expect } from 'vitest'
import { secundariasDe, nombreGrupo, puedeSerPrincipal, puedeUnirse } from './mesasUnidas'

// 3 es principal de 4; 5 y 6 están sueltas.
const MESAS = [
  { id: 'm3', numero: '3', joined_to: null },
  { id: 'm4', numero: '4', joined_to: 'm3' },
  { id: 'm5', numero: '5', joined_to: null },
  { id: 'm6', numero: '6' },
]

describe('mesas unidas', () => {
  it('encuentra las secundarias de una principal', () => {
    expect(secundariasDe(MESAS, 'm3').map((m) => m.numero)).toEqual(['4'])
    expect(secundariasDe(MESAS, 'm5')).toEqual([])
  })

  it('arma el nombre del grupo', () => {
    expect(nombreGrupo('3', [{ numero: '4' }, { numero: '5' }])).toBe('3 + 4 + 5')
    expect(nombreGrupo('Terraza')).toBe('Terraza')
  })

  it('una secundaria no puede hacer de principal', () => {
    expect(puedeSerPrincipal(MESAS[1])).toBe(false)
    expect(puedeSerPrincipal(MESAS[0])).toBe(true)
    expect(puedeSerPrincipal(MESAS[3])).toBe(true) // sin joined_to (mock) = suelta
  })

  it('solo se suman mesas sueltas: ni la principal misma, ni una ya unida, ni otra principal', () => {
    expect(puedeUnirse(MESAS, MESAS[2], 'm3')).toBe(true)
    expect(puedeUnirse(MESAS, MESAS[0], 'm3')).toBe(false) // ella misma
    expect(puedeUnirse(MESAS, MESAS[1], 'm5')).toBe(false) // ya unida a la 3
    expect(puedeUnirse(MESAS, MESAS[0], 'm5')).toBe(false) // la 3 tiene secundarias: sería cadena
  })
})
