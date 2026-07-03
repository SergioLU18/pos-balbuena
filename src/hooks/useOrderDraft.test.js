import { describe, it, expect } from 'vitest'
import { buildDraftItem, toggleDividido, setMitadField, calcItemPrecio, calcSubtotal } from './useOrderDraft'
import { MENU } from '../lib/mockMenu'

const sope = MENU.find((p) => p.id === 'sope') // tiers: Sencillo 110, 1 ing 140, 2 ing 165, 3 ing 190

describe('buildDraftItem', () => {
  it('crea un renglón completo (no dividido) con el precio del tier', () => {
    const item = buildDraftItem(sope, 2) // 2 Ingredientes -> 165
    expect(item.dividido).toBe(false)
    expect(item.mitades).toHaveLength(1)
    expect(calcItemPrecio(item)).toBe(165)
  })
})

describe('toggleDividido', () => {
  it('divide el renglón en mitades izquierda/derecha', () => {
    const item = toggleDividido(buildDraftItem(sope, 1)) // 1 Ingrediente -> 140
    expect(item.dividido).toBe(true)
    expect(item.mitades.map((m) => m.lado)).toEqual(['izquierda', 'derecha'])
  })

  it('vuelve a unir preservando lo elegido en la primera mitad', () => {
    let item = toggleDividido(buildDraftItem(sope, 1))
    item = setMitadField(item, 'izquierda', 'ingredientes', ['Chicharrón Prensado'])
    item = toggleDividido(item)
    expect(item.dividido).toBe(false)
    expect(item.mitades[0].ingredientes).toEqual(['Chicharrón Prensado'])
    expect(item.mitades[0].lado).toBe('completo')
  })
})

describe('calcItemPrecio — ejemplo real: medio sope empalizado sin crema, mitad chicharrón con crema sin frijol', () => {
  it('suma el precio del tier + recargos de ingredientes con costo extra, sin duplicar el precio base', () => {
    let item = toggleDividido(buildDraftItem(sope, 1)) // 1 Ingrediente -> 140, sin recargos
    item = setMitadField(item, 'izquierda', 'ingredientes', ['Pollo Deshebrado'])
    item = setMitadField(item, 'izquierda', 'modificadores', ['Sin Crema'])
    item = setMitadField(item, 'derecha', 'ingredientes', ['Chicharrón Prensado'])
    item = setMitadField(item, 'derecha', 'modificadores', ['Sin Frijol'])
    expect(calcItemPrecio(item)).toBe(140)
  })

  it('agrega el recargo cuando se elige un ingrediente con costo extra (ej. Huitlacoche +$15)', () => {
    let item = toggleDividido(buildDraftItem(sope, 1))
    item = setMitadField(item, 'izquierda', 'ingredientes', ['Huitlacoche'])
    item = setMitadField(item, 'derecha', 'ingredientes', ['Aguacate'])
    expect(calcItemPrecio(item)).toBe(140 + 15)
  })
})

describe('calcSubtotal', () => {
  it('suma precio unitario * cantidad de todos los renglones', () => {
    const a = buildDraftItem(sope, 0) // Sencillo -> 110
    const b = { ...buildDraftItem(sope, 2), cantidad: 2 } // 2 Ingredientes -> 165 x2
    expect(calcSubtotal([a, b])).toBe(110 + 165 * 2)
  })
})
