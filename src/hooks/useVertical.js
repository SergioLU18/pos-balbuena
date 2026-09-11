import { useSyncExternalStore } from 'react'

// ¿La tablet está en vertical? Las pantallas del mesero están diseñadas para iPad en
// horizontal; en vertical (744–834 px de ancho) el ticket ya no cabe al lado del menú y
// hay que reacomodar.
//
// Se decide por ANCHO y no con `(orientation: portrait)` a propósito: lo que rompe el
// layout es la falta de ancho, no la orientación. Un iPad grande en vertical (1024 px)
// sí cabe con el layout normal, y en Android el teclado del sistema achica el alto de la
// ventana, lo que con `orientation` voltearía el layout a media captura.
const QUERY = '(max-width: 900px)'

function suscribir(onCambio) {
  const mql = window.matchMedia?.(QUERY)
  if (!mql) return () => {}
  mql.addEventListener('change', onCambio)
  return () => mql.removeEventListener('change', onCambio)
}

// Sin matchMedia (jsdom en tests) se asume horizontal, el layout de siempre.
const leer = () => window.matchMedia?.(QUERY).matches ?? false

export function useVertical() {
  return useSyncExternalStore(suscribir, leer, () => false)
}
