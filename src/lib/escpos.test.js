import { describe, it, expect } from 'vitest'
import { partirTexto, maquetar, codificar, aEscPos, aBase64, COLUMNAS } from './escpos'
import { preCuenta } from './tickets'
import { NEGOCIO } from './negocio'

describe('partirTexto', () => {
  it('corta entre palabras sin pasarse del ancho', () => {
    expect(partirTexto('uno dos tres cuatro', 9)).toEqual(['uno dos', 'tres', 'cuatro'])
  })
  it('corta a la fuerza una palabra más larga que el renglón', () => {
    expect(partirTexto('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })
})

describe('maquetar', () => {
  it('centra con espacios', () => {
    const [r] = maquetar([{ tipo: 'texto', texto: 'HOLA', alinear: 'centro' }], 10)
    expect(r.texto).toBe('   HOLA')
  })
  it('pega el importe a la derecha y sangra la continuación al ancho del prefijo', () => {
    const rs = maquetar([{ tipo: 'columnas', prefijo: '2 ', izq: 'Tacos al pastor', der: '$90' }], 16)
    expect(rs.map((r) => r.texto)).toEqual(['2 Tacos al   $90', '  pastor'])
    rs.forEach((r) => expect(r.texto.length).toBeLessThanOrEqual(16))
  })
  it('en letra grande caben la mitad de columnas', () => {
    const [r] = maquetar([{ tipo: 'linea', grande: true }])
    expect(r.texto.length).toBe(COLUMNAS / 2)
  })
  it('ningún renglón de un ticket real se pasa del ancho', () => {
    const items = [{ nombre: 'Huarache · Grande (Pastor, Suadero / Extras: Queso, Nopal)', cantidad: 12, precio_unitario: 1234.5 }]
    for (const r of maquetar(preCuenta({ negocio: NEGOCIO, mesa: 'Mesa 7', mesero: 'Luis', items }))) {
      expect(r.texto.length).toBeLessThanOrEqual(r.grande ? COLUMNAS / 2 : COLUMNAS)
    }
  })
})

describe('codificar (PC850)', () => {
  it('manda acentos, ñ y signos de apertura con su código', () => {
    expect(codificar('ñ¡¿é')).toEqual([0xa4, 0xad, 0xa8, 0x82])
  })
  it('lo que no está en la tabla sale sin acento o como ?', () => {
    expect(codificar('ê−€')).toEqual([0x65, 0x2d, 0x3f])
  })
})

describe('aEscPos', () => {
  it('inicializa, fija PC850 y termina con corte', () => {
    const b = Array.from(aEscPos([{ tipo: 'texto', texto: 'x' }]))
    expect(b.slice(0, 5)).toEqual([0x1b, 0x40, 0x1b, 0x74, 2])
    expect(b.slice(-4)).toEqual([0x1d, 0x56, 0x42, 0])
  })
  it('aBase64 conserva los bytes', () => {
    const bytes = Uint8Array.from([0, 0xa4, 0xff])
    expect(Uint8Array.from(atob(aBase64(bytes)), (c) => c.charCodeAt(0))).toEqual(bytes)
  })
})
