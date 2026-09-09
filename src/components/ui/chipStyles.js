/** Rejilla uniforme para un grupo de chips: todas las columnas del mismo ancho y
 *  todos los renglones de la misma altura (`1fr`), así ningún botón queda más chico
 *  que otro. `auto-fit` reparte el ancho disponible entre las columnas que quepan,
 *  de modo que con pocos chips estos crecen para llenar el renglón. */
export const chipGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gridAutoRows: '1fr',
  gap: 10,
}
