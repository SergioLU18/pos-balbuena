// Contenido de cada ticket impreso, como bloques para escpos.js. Aquí solo se decide
// QUÉ dice el ticket; cómo se acomoda en las 48 columnas lo resuelve maquetar().
import { f } from './utils'
import { describirMitades, extrasTexto } from './describirItem'

/** "02/10/2026 14:05" en hora local. */
export function fechaTicket(fecha = new Date()) {
  const d = new Date(fecha)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`
}

/** Nombre comercial y datos fiscales: el mismo arranque para todos los tickets. */
export function encabezado(negocio) {
  const centro = (texto) => ({ tipo: 'texto', texto, alinear: 'centro' })
  return [
    { tipo: 'texto', texto: negocio.nombre, alinear: 'centro', grande: true },
    { tipo: 'espacio' },
    centro(negocio.razonSocial),
    centro(`R.F.C. ${negocio.rfc}`),
    centro(`CURP ${negocio.curp}`),
    centro(negocio.regimen),
    ...negocio.direccion.map(centro),
    centro(negocio.telefonos),
    { tipo: 'linea' },
  ]
}

/** Renglones de consumo: "2  Tacos al pastor ......... $90.00". `items` en la forma
 *  plana de cuenta_items: { nombre, cantidad, precio_unitario }. */
export function conceptos(items) {
  return items.map((it) => ({
    tipo: 'columnas',
    prefijo: String(it.cantidad).padEnd(4),
    izq: it.nombre,
    der: f(Number(it.precio_unitario) * it.cantidad),
  }))
}

export function totalDe(items) {
  return items.reduce((s, it) => s + Number(it.precio_unitario) * it.cantidad, 0)
}

/** Ticket de prueba (Ajustes → Impresora). */
export function ticketPrueba(negocio, fecha = new Date()) {
  const items = [
    { nombre: 'Tacos al pastor', cantidad: 2, precio_unitario: 45 },
    { nombre: 'Agua de jamaica', cantidad: 1, precio_unitario: 35 },
    { nombre: 'Quesadilla con champiñones y queso Oaxaca (extra de chicharrón)', cantidad: 1, precio_unitario: 55 },
  ]
  return [
    ...encabezado(negocio),
    { tipo: 'texto', texto: 'TICKET DE PRUEBA', alinear: 'centro', negrita: true },
    { tipo: 'texto', texto: fechaTicket(fecha), alinear: 'centro' },
    { tipo: 'linea' },
    ...conceptos(items),
    { tipo: 'linea' },
    { tipo: 'columnas', izq: 'TOTAL', der: f(totalDe(items)), negrita: true },
    { tipo: 'espacio' },
    { tipo: 'texto', texto: '¡Gracias por su visita!', alinear: 'centro' },
  ]
}

/** Pre-cuenta: lo que se lleva a la mesa ANTES de cobrar. Sin folio — el folio solo
 *  existe para pagos con tarjeta y se asigna al cobrar, cuando ya se sabe el método. */
export function preCuenta({ negocio, mesa, mesero, items, fecha = new Date() }) {
  return [
    ...encabezado(negocio),
    { tipo: 'texto', texto: 'PRE-CUENTA', alinear: 'centro', negrita: true },
    { tipo: 'columnas', izq: mesa, der: fechaTicket(fecha) },
    ...(mesero ? [{ tipo: 'texto', texto: `Atendió: ${mesero}` }] : []),
    { tipo: 'linea' },
    ...conceptos(items),
    { tipo: 'linea' },
    { tipo: 'columnas', izq: 'TOTAL', der: f(totalDe(items)), negrita: true },
    { tipo: 'espacio' },
    { tipo: 'texto', texto: 'Precios con IVA incluido.', alinear: 'centro' },
    { tipo: 'texto', texto: 'Este documento no es un comprobante de pago ni un comprobante fiscal.', alinear: 'centro' },
    { tipo: 'espacio' },
    { tipo: 'texto', texto: '¡Gracias por su visita!', alinear: 'centro' },
  ]
}

/** Comanda: lo que se imprime al enviar a cocina, para que quede en papel qué se pidió.
 *  Solo informativa: sin precios ni datos fiscales. Todo va en doble alto (`alto`), que se
 *  lee más grande sin perder ancho — las 48 columnas completas, a diferencia de `grande`.
 *  `items` son los renglones ricos del draft (platilloNombre, tier, mitades, extras, nota,
 *  empaque). `llevar` = la orden completa es para llevar: ahí el desechable es lo normal y
 *  no se repite en cada renglón, igual que en las tarjetas de cocina (ItemLine). */
export function comanda({ destino, mesero, items, fecha = new Date(), llevar = false }) {
  const detalle = (texto, extra = {}) => ({ tipo: 'columnas', prefijo: '   ', izq: texto, der: '', alto: true, ...extra })
  const hora = fechaTicket(fecha).slice(-5)
  return [
    { tipo: 'texto', texto: destino, alinear: 'centro', grande: true, negrita: true },
    { tipo: 'columnas', izq: mesero ? `Mesero: ${mesero}` : 'Comanda', der: hora, alto: true },
    { tipo: 'linea', caracter: '=' },
    ...items.flatMap((it, i) => [
      ...(i > 0 ? [{ tipo: 'linea' }] : []),
      {
        tipo: 'columnas',
        prefijo: `${it.cantidad}x `,
        izq: `${it.platilloNombre} · ${it.tier.nombre}`,
        der: '',
        negrita: true,
        alto: true,
      },
      ...(it.modificaOriginal ? [detalle(`CAMBIO, reemplaza: ${it.modificaOriginal}`, { negrita: true })] : []),
      ...describirMitades(it)
        .filter((d) => !/^Sin personalizar$/.test(d.texto))
        .map((d) => detalle(d.texto)),
      ...(extrasTexto(it) ? [detalle(extrasTexto(it))] : []),
      ...(it.nota ? [detalle(`NOTA: ${it.nota}`, { negrita: true })] : []),
      ...(it.empaque === 'tupper' ? [detalle('** VA EN SU TUPPER **', { negrita: true })] : []),
      ...(it.empaque === 'plastico' && !llevar ? [detalle('** PARA LLEVAR **', { negrita: true })] : []),
    ]),
    { tipo: 'linea', caracter: '=' },
  ]
}

/** Comanda de ejemplo para la vista previa de Ajustes → Impresora. */
export function comandaPrueba(fecha = new Date()) {
  const item = (platilloNombre, tier, cantidad, partes = [], extra = {}) => ({
    platilloNombre, tier: { nombre: tier }, cantidad,
    mitades: [{ lado: 'completo', ingredientes: partes, modificadores: [] }],
    ...extra,
  })
  return comanda({
    destino: 'Mesa 4',
    mesero: 'Mayra',
    fecha,
    items: [
      item('Sope', 'Doble', 2, ['Pollo deshebrado', 'Sin crema']),
      item('Quesadilla', 'Sencilla', 1, ['Champiñones'], { extras: [{ nombre: 'Queso Oaxaca' }], nota: 'Bien dorada' }),
      item('Agua de jamaica', 'Grande', 1, [], { empaque: 'plastico' }),
    ],
  })
}
