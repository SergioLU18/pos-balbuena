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
 *  mitad). Devuelve null si no hay extras. */
export function extrasTexto(item) {
  const nombres = (item.extras ?? []).map((e) => e.nombre)
  return nombres.length ? `Extras: ${nombres.join(', ')}` : null
}
