import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { buildDraftItem, toggleDividido, setMitadField, calcItemPrecio, calcSubtotal, nombreItem, useOrderDraft } from './useOrderDraft'
import { MENU } from '../lib/mockMenu'
import { MESAS } from '../lib/mockMesas'
import { MESEROS } from '../lib/mockMeseros'
import { useOrderStore, usePedidosStore, useMeseroStore, usePosStore, useMesaPagadaStore } from '../store/appStore'

const sope = MENU.find((p) => p.id === 'sope')
// Índice por nombre de tier (robusto al orden: el Sope tiene además "Sencillo con Chorizo").
const idx = (nombre) => sope.tiers.findIndex((t) => t.nombre === nombre)
const I_SENCILLO = idx('Sencillo')       // 110
const I_1ING = idx('1 Ingrediente')      // 140
const I_2ING = idx('2 Ingredientes')     // 165

const mesa1 = MESAS[0]

beforeEach(() => {
  useOrderStore.setState({ drafts: {}, cuentas: {} })
  usePedidosStore.setState({ pedidos: [] })
  useMesaPagadaStore.setState({ pagadas: {} })
  useMeseroStore.setState({ currentMeseroId: MESEROS[0].id, soloMisMesas: false })
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS, asignaciones: [] })
})

describe('buildDraftItem', () => {
  it('crea un renglón completo (no dividido) con el precio del tier', () => {
    const item = buildDraftItem(sope, I_2ING) // 2 Ingredientes -> 165
    expect(item.dividido).toBe(false)
    expect(item.mitades).toHaveLength(1)
    expect(calcItemPrecio(item)).toBe(165)
  })
})

describe('toggleDividido', () => {
  it('divide el renglón en mitades izquierda/derecha', () => {
    const item = toggleDividido(buildDraftItem(sope, I_1ING)) // 1 Ingrediente -> 140
    expect(item.dividido).toBe(true)
    expect(item.mitades.map((m) => m.lado)).toEqual(['izquierda', 'derecha'])
  })

  it('vuelve a unir preservando lo elegido en la primera mitad', () => {
    let item = toggleDividido(buildDraftItem(sope, I_1ING))
    item = setMitadField(item, 'izquierda', 'ingredientes', ['Chicharrón Prensado'])
    item = toggleDividido(item)
    expect(item.dividido).toBe(false)
    expect(item.mitades[0].ingredientes).toEqual(['Chicharrón Prensado'])
    expect(item.mitades[0].lado).toBe('completo')
  })
})

describe('calcItemPrecio — ejemplo real: medio sope empalizado sin crema, mitad chicharrón con crema sin frijol', () => {
  it('suma el precio del tier + recargos de ingredientes con costo extra, sin duplicar el precio base', () => {
    let item = toggleDividido(buildDraftItem(sope, I_1ING)) // 1 Ingrediente -> 140, sin recargos
    item = setMitadField(item, 'izquierda', 'ingredientes', ['Pollo Deshebrado'])
    item = setMitadField(item, 'izquierda', 'modificadores', ['Sin Crema'])
    item = setMitadField(item, 'derecha', 'ingredientes', ['Chicharrón Prensado'])
    item = setMitadField(item, 'derecha', 'modificadores', ['Sin Frijol'])
    expect(calcItemPrecio(item)).toBe(140)
  })

  it('agrega el recargo cuando se elige un ingrediente con costo extra (ej. Huitlacoche +$15)', () => {
    let item = toggleDividido(buildDraftItem(sope, I_1ING))
    item = setMitadField(item, 'izquierda', 'ingredientes', ['Huitlacoche'])
    item = setMitadField(item, 'derecha', 'ingredientes', ['Aguacate'])
    expect(calcItemPrecio(item)).toBe(140 + 15)
  })

  it('suma los extras de pago del platillo (nivel platillo, no por mitad)', () => {
    let item = buildDraftItem(sope, I_1ING) // 140
    item = { ...item, extras: [{ nombre: 'Aguacate', precio: 30 }, { nombre: 'Crema', precio: 10 }] }
    expect(calcItemPrecio(item)).toBe(140 + 40)
  })
})

describe('calcSubtotal', () => {
  it('suma precio unitario * cantidad de todos los renglones', () => {
    const a = buildDraftItem(sope, I_SENCILLO) // Sencillo -> 110
    const b = { ...buildDraftItem(sope, I_2ING), cantidad: 2 } // 2 Ingredientes -> 165 x2
    expect(calcSubtotal([a, b])).toBe(110 + 165 * 2)
  })
})

describe('extras libres (escritos por el mesero)', () => {
  it('suma su precio como cualquier otro extra', () => {
    let item = buildDraftItem(sope, I_1ING) // 140
    item = { ...item, extras: [{ nombre: 'Un huevo', precio: 15, libre: true }] }
    expect(calcItemPrecio(item)).toBe(140 + 15)
  })

  // cuenta_items agrupa por nombre: si dos "Huevo" con precio distinto produjeran el
  // mismo nombre, el segundo se cobraría al precio del primero.
  it('lleva su precio en el nombre facturable, para no colapsar con otro del mismo nombre', () => {
    const base = buildDraftItem(sope, I_1ING)
    const a = { ...base, extras: [{ nombre: 'Huevo', precio: 15, libre: true }] }
    const b = { ...base, extras: [{ nombre: 'Huevo', precio: 20, libre: true }] }
    expect(nombreItem(a)).toContain('Huevo (+$15.00)')
    expect(nombreItem(a)).not.toBe(nombreItem(b))
  })

  it('los del catálogo siguen saliendo sin precio (su precio lo fija el catálogo)', () => {
    const item = { ...buildDraftItem(sope, I_1ING), extras: [{ nombre: 'Aguacate', precio: 30 }] }
    expect(nombreItem(item)).toContain('Extras: Aguacate')
    expect(nombreItem(item)).not.toContain('$30')
  })
})

describe('useOrderDraft — cierre de mesa marca "pagada"', () => {
  it('cerrarMesa limpia la cuenta y los pedidos, y marca la mesa como pagada con su total', () => {
    useOrderStore.setState({
      cuentas: { [mesa1.id]: { items: [buildDraftItem(sope, I_2ING)], createdAt: new Date().toISOString() } },
    })
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: mesa1.id, mesaNumero: mesa1.numero, meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'entregado' }],
    })
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.cerrarMesa('efectivo'))

    expect(useOrderStore.getState().cuentas[mesa1.id]).toBeUndefined()
    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
    expect(useMesaPagadaStore.getState().pagadas[mesa1.id]).toMatchObject({ total: 165 })
  })
})

describe('useOrderDraft — reabrir una mesa pagada', () => {
  it('agregarPlatillo apaga el badge de pagada al instante, sin esperar el timeout', () => {
    useMesaPagadaStore.setState({ pagadas: { [mesa1.id]: { at: new Date().toISOString(), total: 165 } } })
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.agregarPlatillo(sope, I_2ING))

    expect(useMesaPagadaStore.getState().pagadas[mesa1.id]).toBeUndefined()
    expect(result.current.draft).toHaveLength(1)
  })
})
