import { describe, it, expect } from 'vitest'
import {
  atiende, conMesero, sinMesero, sinMesa, sinMeseroEnTodas,
  mesasDeMesero, meserosDeMesa, fijarMesasDeMesero,
} from './asignaciones'

// Reparto de arranque: la mesa A la atienden dos meseros a la vez — el caso que
// motivó todo esto (dos meseros tomando órdenes de la misma mesa).
const BASE = [
  { mesaId: 'A', meseroId: 'rosa' },
  { mesaId: 'A', meseroId: 'beto' },
  { mesaId: 'B', meseroId: 'rosa' },
  { mesaId: 'C', meseroId: 'beto' },
]

describe('asignaciones — consulta desde los dos lados', () => {
  it('una mesa puede devolver varios meseros', () => {
    expect(meserosDeMesa(BASE, 'A')).toEqual(['rosa', 'beto'])
    expect(meserosDeMesa(BASE, 'C')).toEqual(['beto'])
  })

  it('un mesero puede devolver varias mesas', () => {
    expect(mesasDeMesero(BASE, 'rosa')).toEqual(['A', 'B'])
  })

  it('atiende() responde por el par exacto, no por la mesa ni por el mesero sueltos', () => {
    expect(atiende(BASE, 'A', 'beto')).toBe(true)
    expect(atiende(BASE, 'B', 'beto')).toBe(false)
    expect(atiende(BASE, 'A', null)).toBe(false)
  })
})

describe('asignaciones — sumar un mesero a una mesa', () => {
  it('lo agrega sin desplazar a los que ya estaban', () => {
    const next = conMesero(BASE, 'C', 'lupita')
    expect(meserosDeMesa(next, 'C')).toEqual(['beto', 'lupita'])
  })

  it('es idempotente y conserva la referencia si ya atendía la mesa', () => {
    // Importante para los selectores de zustand, que comparan por identidad: un
    // arreglo nuevo con el mismo contenido volvería a renderizar el mapa del piso.
    expect(conMesero(BASE, 'A', 'rosa')).toBe(BASE)
  })
})

describe('asignaciones — quitar', () => {
  it('sinMesero deja a los demás meseros de esa mesa intactos', () => {
    expect(meserosDeMesa(sinMesero(BASE, 'A', 'rosa'), 'A')).toEqual(['beto'])
  })

  it('sinMesa la suelta por completo', () => {
    expect(meserosDeMesa(sinMesa(BASE, 'A'), 'A')).toEqual([])
    expect(mesasDeMesero(sinMesa(BASE, 'A'), 'rosa')).toEqual(['B'])
  })

  it('sinMeseroEnTodas lo saca de todas sus mesas y de ninguna ajena', () => {
    const next = sinMeseroEnTodas(BASE, 'beto')
    expect(mesasDeMesero(next, 'beto')).toEqual([])
    expect(mesasDeMesero(next, 'rosa')).toEqual(['A', 'B'])
  })
})

describe('asignaciones — fijar el reparto de un mesero', () => {
  it('deja sus mesas exactamente en la lista dada', () => {
    const next = fijarMesasDeMesero(BASE, 'rosa', ['C', 'D'])
    expect(mesasDeMesero(next, 'rosa').sort()).toEqual(['C', 'D'])
  })

  it('no toca el reparto de los demás, ni siquiera en las mesas que comparten', () => {
    const next = fijarMesasDeMesero(BASE, 'rosa', [])
    expect(meserosDeMesa(next, 'A')).toEqual(['beto'])
    expect(mesasDeMesero(next, 'beto')).toEqual(['A', 'C'])
  })

  it('no duplica una mesa que el mesero ya atendía', () => {
    const next = fijarMesasDeMesero(BASE, 'rosa', ['A', 'A', 'B'])
    expect(mesasDeMesero(next, 'rosa')).toEqual(['A', 'B'])
  })
})
