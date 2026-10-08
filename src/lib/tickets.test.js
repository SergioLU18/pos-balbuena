import { describe, it, expect } from 'vitest'
import { comanda } from './tickets'
import { maquetar } from './escpos'

const item = (extra = {}) => ({
  platilloNombre: 'Sope', tier: { nombre: 'Doble' }, cantidad: 2,
  mitades: [{ lado: 'completo', ingredientes: ['Pollo deshebrado'], modificadores: ['Sin crema'] }],
  precio_unitario: 120,
  ...extra,
})
const texto = (bloques) => maquetar(bloques).map((r) => r.texto).join('\n')

describe('comanda', () => {
  it('lleva destino, mesero, cantidad, platillo e ingredientes, sin precios', () => {
    const t = texto(comanda({ destino: 'Mesa 4', mesero: 'Mayra', items: [item()] }))
    expect(t).toContain('Mesa 4')
    expect(t).toContain('Mesero: Mayra')
    expect(t).toContain('2x Sope · Doble')
    expect(t).toContain('Pollo deshebrado, Sin crema')
    expect(t).not.toContain('$')
  })

  it('no imprime "Sin personalizar" y sí la nota y los extras', () => {
    const t = texto(comanda({
      destino: 'Mesa 1',
      items: [item({ mitades: [{ lado: 'completo', ingredientes: [], modificadores: [] }], nota: 'Bien dorado', extras: [{ nombre: 'Queso' }] })],
    }))
    expect(t).not.toContain('Sin personalizar')
    expect(t).toContain('NOTA: Bien dorado')
    expect(t).toContain('Extras: Queso')
  })

  it('avisa el empaque solo cuando cambia lo que hace cocina', () => {
    const mesa = texto(comanda({ destino: 'Mesa 2', items: [item({ empaque: 'plastico' })] }))
    const llevar = texto(comanda({ destino: 'Para llevar L-3', items: [item({ empaque: 'plastico' }), item({ empaque: 'tupper' })], llevar: true }))
    expect(mesa).toContain('PARA LLEVAR')
    expect(llevar).not.toContain('** PARA LLEVAR **')
    expect(llevar).toContain('VA EN SU TUPPER')
  })

  it('platillo en fuente B grande y detalle en doble alto a todo lo ancho', () => {
    const renglones = maquetar(comanda({ destino: 'Mesa 4', items: [item()] }))
    const platillo = renglones.find((r) => r.texto.startsWith('2x Sope'))
    const detalle = renglones.find((r) => r.texto.includes('Pollo deshebrado'))
    expect(platillo).toMatchObject({ grande: true, fuenteB: true, negrita: true })
    expect(platillo.texto.length).toBe(32)
    expect(detalle).toMatchObject({ alto: true, fuenteB: false })
    expect(detalle.texto.length).toBe(48)
  })

  it('marca los renglones que reemplazan a uno ya enviado', () => {
    const t = texto(comanda({ destino: 'Mesa 3', items: [item({ modificaOriginal: 'Sope · Sencillo' })] }))
    expect(t).toContain('CAMBIO, reemplaza: Sope · Sencillo')
  })
})
