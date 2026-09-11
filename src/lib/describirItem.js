import { f } from './utils'

/** Líneas descriptivas de un renglón de orden (ingredientes + modificadores por mitad).
 *  Compartido entre la comanda del mesero y las tarjetas de cocina. */
export function describirMitades(item) {
  return item.mitades.map((mitad) => {
    const partes = [...mitad.ingredientes, ...mitad.modificadores]
    const prefijo = item.dividido ? { izquierda: 'Mitad 1: ', derecha: 'Mitad 2: ' }[mitad.lado] : ''
    const texto = partes.length > 0 ? partes.join(', ') : 'Sin personalizar'
    return { lado: mitad.lado, prefijo, texto }
  })
}

/** Resumen de los extras (agregados de pago) de un renglón, a nivel platillo (no por
 *  mitad). Devuelve null si no hay extras.
 *
 *  Los extras libres (escritos por el mesero) llevan su precio en el texto. No es adorno:
 *  este texto entra en nombreItem(), y cuenta_items agrupa por nombre — sin el precio,
 *  un "Huevo +$15" y un "Huevo +$20" caerían en el mismo renglón de la cuenta al mismo
 *  precio. Los del catálogo no lo necesitan: su precio lo fija el catálogo, no el mesero. */
export function extrasTexto(item) {
  const partes = (item.extras ?? []).map((e) => (e.libre ? `${e.nombre} (+${f(e.precio)})` : e.nombre))
  return partes.length ? `Extras: ${partes.join(', ')}` : null
}
