import { describe, it, expect } from 'vitest'
import { ACCIONES, GRUPOS, accionesDelGrupo, describir, esSensible, grupoDe, importe, renglones, sujeto } from './eventos'

const ev = (accion, detalle = {}, resto = {}) => ({ accion, detalle, entidad: null, etiqueta: null, ...resto })

describe('describir', () => {
  it('cuenta piezas y no renglones al mandar a cocina', () => {
    const items = [{ cantidad: 3 }, { cantidad: 1 }]
    expect(describir(ev('orden.enviar', { renglones: 2, items }))).toBe('Mandó 4 platillos a cocina')
    expect(describir(ev('orden.enviar', { items: [{ cantidad: 1 }] }))).toBe('Mandó 1 platillo a cocina')
  })

  it('dice qué se quitó y cuánto', () => {
    expect(describir(ev('item.eliminar', { platillo: 'Sope', cantidad: 2 }))).toBe('Quitó 2× Sope ya enviado')
    expect(describir(ev('item.editar', { platillo: 'Sope', de: 2, a: 3 }))).toBe('Cambió Sope de 2 a 3')
  })

  it('usa los nombres de columna del tablero de cocina', () => {
    expect(describir(ev('cocina.estado', { de: 'pendiente', a: 'preparando' }))).toBe('Movió la comanda de Nuevo a Preparando')
  })

  it('resume un cambio de precio del menú', () => {
    const d = { antes: { nombre: 'Huarache', precio: 45, activo: true }, despues: { nombre: 'Huarache', precio: 60, activo: true } }
    expect(describir(ev('platillo.editar', d))).toBe('Cambió el precio de $45.00 a $60.00')
  })

  it('junta varios cambios y cae en el genérico si no cambió nada visible', () => {
    const d = { antes: { nombre: 'Aguacate', precio: 15, activo: true }, despues: { nombre: 'Aguacate', precio: 15, activo: false } }
    expect(describir(ev('extra.editar', d))).toBe('Lo desactivó')
    const igual = { antes: { nombre: 'X', precio: 10 }, despues: { nombre: 'X', precio: 10 } }
    expect(describir(ev('platillo.editar', igual))).toBe('Editó el platillo')
  })

  it('en un mesero, dice permisos y PIN sin revelar el PIN', () => {
    const d = { antes: { nombre: 'Ana', es_admin: false }, despues: { nombre: 'Ana', es_admin: true }, cambio_pin: true }
    expect(describir(ev('mesero.editar', d))).toBe('Le dio permisos de admin, le cambió el PIN')
  })

  it('distingue entregar de cancelar una orden para llevar', () => {
    expect(describir(ev('llevar.cerrar', { estado: 'cancelada' }))).toBe('Canceló la orden para llevar')
    expect(describir(ev('llevar.cerrar', { estado: 'entregada' }))).toBe('Entregó la orden para llevar')
  })

  it('nombra la mesa que se unió o separó, y el dinero que traía', () => {
    expect(describir(ev('mesa.unir', { secundaria: '4', importe: 120 }))).toBe('Le unió la Mesa 4 y pasó su cuenta de $120.00')
    expect(describir(ev('mesa.unir', { secundaria: '4', importe: 0 }))).toBe('Le unió la Mesa 4')
    expect(describir(ev('mesa.separar', { secundaria: '4' }))).toBe('Le separó la Mesa 4')
    // Pasar dinero de una cuenta a otra no es venta: no suma en el importe del turno.
    expect(importe(ev('mesa.unir', { importe: 120 }))).toBeNull()
  })

  it('una acción desconocida se muestra tal cual en vez de romper', () => {
    expect(describir(ev('mesa.fusionar'))).toBe('mesa.fusionar')
  })
})

describe('sujeto', () => {
  it('nombra la mesa o la orden según el tipo de la comanda', () => {
    expect(sujeto(ev('mesa.cerrar', {}, { entidad: 'mesa', etiqueta: '7' }))).toBe('Mesa 7')
    expect(sujeto(ev('item.eliminar', { tipo: 'mesa' }, { entidad: 'pedido', etiqueta: 'PL-7' }))).toBe('Mesa PL-7')
    expect(sujeto(ev('cocina.estado', { tipo: 'llevar' }, { entidad: 'pedido', etiqueta: 'Doña Mari' }))).toBe('Para llevar · Doña Mari')
    expect(sujeto(ev('llevar.crear', {}, { entidad: 'orden_llevar', etiqueta: 'L-14' }))).toBe('L-14')
  })

  it('no inventa sujeto cuando no hay etiqueta', () => {
    expect(sujeto(ev('mesa.reordenar'))).toBeNull()
  })
})

describe('importe', () => {
  it('lo quitado de una cuenta va negativo', () => {
    expect(importe(ev('item.eliminar', { importe: 60 }))).toBe(-60)
    expect(importe(ev('mesa.cerrar', { total: 135 }))).toBe(135)
    expect(importe(ev('orden.enviar', { importe: 150 }))).toBe(150)
  })

  it('las acciones sin dinero no tienen importe', () => {
    expect(importe(ev('mesa.crear'))).toBeNull()
  })
})

describe('esSensible', () => {
  it('marca lo que quita dinero o toca precios y permisos', () => {
    expect(esSensible(ev('item.eliminar'))).toBe(true)
    expect(esSensible(ev('item.editar', { de: 3, a: 1 }))).toBe(true)
    expect(esSensible(ev('llevar.cerrar', { estado: 'cancelada' }))).toBe(true)
    expect(esSensible(ev('platillo.editar', { cambio_precio: true }))).toBe(true)
    expect(esSensible(ev('mesero.editar', { cambio_pin: true }))).toBe(true)
  })

  it('no marca la operación normal', () => {
    expect(esSensible(ev('item.editar', { de: 1, a: 3 }))).toBe(false)
    expect(esSensible(ev('llevar.cerrar', { estado: 'entregada' }))).toBe(false)
    expect(esSensible(ev('orden.enviar'))).toBe(false)
    expect(esSensible(ev('platillo.editar', { cambio_precio: false }))).toBe(false)
  })
})

describe('renglones', () => {
  it('toma el ticket completo o el renglón suelto', () => {
    expect(renglones(ev('mesa.cerrar', { items: [{ nombre: 'A' }, { nombre: 'B' }] }))).toHaveLength(2)
    expect(renglones(ev('item.eliminar', { item: { nombre: 'A' } }))).toEqual([{ nombre: 'A' }])
    expect(renglones(ev('mesa.crear'))).toEqual([])
  })
})

describe('grupos', () => {
  it('toda acción conocida cae en un grupo existente y ningún grupo queda vacío', () => {
    for (const a of ACCIONES) expect(GRUPOS[grupoDe(a)]).toBeDefined()
    for (const g of Object.keys(GRUPOS)) expect(accionesDelGrupo(g).length).toBeGreaterThan(0)
  })
})
