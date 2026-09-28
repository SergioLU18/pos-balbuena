// Íconos de línea a juego con el trazo redondeado del resto de la UI (JbFlor, las
// esquinas de Button). Usan currentColor para heredar el color del botón que los
// contiene (rosa activo, tinta o gris), en vez de traer su propio color fijo.
const BASE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

/** Dos mesas que se traslapan en una sola: el gesto de "Unir mesas". */
export function IconUnirMesas({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...BASE}>
      <rect x="3" y="3" width="12" height="12" rx="3" />
      <rect x="9" y="9" width="12" height="12" rx="3" />
    </svg>
  )
}

/** Comanda: una hoja con clip arriba y renglones — el gesto de "ver los pedidos
 *  abiertos". */
export function IconPedidos({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...BASE}>
      <rect x="5" y="3.5" width="14" height="17" rx="3" />
      <path d="M9 3.5v-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M8.5 11h7" />
      <path d="M8.5 15h7" />
    </svg>
  )
}

/** Bolsa de comida para llevar, con vapor arriba — así no se confunde con una bolsa
 *  de compras genérica. */
export function IconParaLlevar({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...BASE}>
      <path d="M7.5 9h9l1.3 10.2a1.6 1.6 0 0 1-1.6 1.8H7.8a1.6 1.6 0 0 1-1.6-1.8L7.5 9Z" />
      <path d="M8.3 12.4h7.4" />
      <path d="M10.2 6.3c0-.9.8-1 .8-1.9s-.8-1-.8-1.9" />
      <path d="M13.8 6.3c0-.9.8-1 .8-1.9s-.8-1-.8-1.9" />
    </svg>
  )
}

/** Insignia de "listo/hecho": cuadrado verde con una palomita blanca — a diferencia de
 *  los de arriba, trae su propio color fijo (no `currentColor`) porque es una insignia
 *  de estado, no un ícono que vaya a heredar el color del botón que lo contiene. */
export function IconExito({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <rect width="56" height="56" rx="16" fill="var(--jb-ok)" />
      <path d="M16 29.5L23.5 37L40 19" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
