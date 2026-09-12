// Paleta de las gráficas de Estadísticas. No son los mismos 8 tonos de la marca
// (--jb-*, ver src/styles/index.css): esos se eligieron para botones y estados,
// no para que ocho series se distingan entre sí a simple vista o con daltonismo.
// Cada lista de abajo pasó el validador de la skill de dataviz (seis chequeos:
// banda de luminosidad, piso de croma, separación CVD adyacente y de todos-contra-
// todos, piso a visión normal, contraste) — no son tonos a ojo.
//
// Superficie de referencia para el contraste: var(--jb-cream) (#FDF6EF), el fondo
// de todo el POS. No hay modo oscuro en esta app (ver index.css) así que no hace
// falta una segunda pasada.

/** Identidad categórica, orden fijo — nunca se reordena ni se reasigna por valor
 *  (ver dataviz/color-formula.md). 8 lugares, pensados para listas RANKEADAS
 *  (barras una junto a otra: solo importa la pareja adyacente) como "venta por
 *  mesero". Pasa los seis chequeos en ese modo; ver statsColors.test.js. */
export const CATEGORICO = [
  '#EA478A', // 1 rosa   — el de la marca, para el primer lugar del ranking
  '#0090A6', // 2 teal
  '#D97757', // 3 naranja (mismo tono que --jb-queued)
  '#3E7CB1', // 4 azul    (mismo tono que --jb-info)
  '#3FA66B', // 5 verde   (mismo tono que --jb-ok)
  '#7A5FC4', // 6 violeta
  '#C79A2E', // 7 dorado  (más saturado que --jb-warn, que falla el piso de croma)
  '#C24545', // 8 rojo
]

/** Mismos 8 tonos, pero en un orden que además pasa CVD todos-contra-todos (no
 *  solo adyacente) — para cuando cualquier par de rebanadas puede quedar junto,
 *  como una dona. Solo los primeros 4 lugares se usan hoy (métodos de pago);
 *  pasar de 4 en esta forma pide separar por facetas, no agregar un 5º tono. */
export const CATEGORICO_DONA = ['#EA478A', '#0090A6', '#7A5FC4', '#C79A2E']

/** Otros = agregado explícito ("y N más"), no una identidad de la lista — por
 *  eso usa el gris de la marca y no un 9º tono categórico. */
export const OTROS = '#A6919A'

/** Magnitud continua (heatmap hora×día): un solo tono, claro→oscuro. El extremo
 *  claro se deja acercar a la superficie a propósito — "sin ventas a esa hora"
 *  debe casi desaparecer, es la lectura correcta para una celda vacía. */
export const SECUENCIAL_ROSA = ['#FCE4EE', '#F9BFD7', '#F38DB4', '#EA478A', '#C22E6C', '#8F2050']

/** Orden discreto donde el orden SÍ es el dato (frecuencia de compra: 1 vez <
 *  2-3 < 4+): un solo tono, monótono, con el extremo claro todavía legible sobre
 *  el fondo (a diferencia del secuencial de arriba, aquí "poco" sigue siendo una
 *  barra visible, no una que se esconde). */
export const ORDINAL_TEAL = ['#6BB8C3', '#2E93A3', '#0B5560']

/** Estado (mejor/peor que el periodo anterior) — no es identidad de serie, va
 *  siempre con un ícono (▲/▼) y nunca reemplaza el texto en tinta neutra. */
export const STATUS = { sube: '#3FA66B', baja: '#C24545', neutro: '#A6919A' }
