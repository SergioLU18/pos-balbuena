// Catálogo de Jardín Balbuena (sucursal Los Pinos), reconstruido a partir del
// menú público real (balbuena.app) y de su sistema de personalización real
// (grupo "Ingredientes" con máximo = nivel del platillo, y modificadores de
// remoción "Sin X" sobre los componentes base). Precios en MXN.

export const INGREDIENTES = [
  { nombre: 'Cochinita Pibil', extra: 0 },
  { nombre: 'Pollo Deshebrado', extra: 0 },
  { nombre: 'Chicharrón Prensado', extra: 0 },
  { nombre: 'Asado', extra: 0 },
  { nombre: 'Asado Rojo', extra: 0 },
  { nombre: 'Chorizo', extra: 0 },
  { nombre: 'Jamón', extra: 0 },
  { nombre: 'Aguacate', extra: 0 },
  { nombre: 'Champiñones', extra: 0 },
  { nombre: 'Papa', extra: 0 },
  { nombre: 'Rajas Poblanas', extra: 0 },
  { nombre: 'Empanizado de Pollo', extra: 15 },
  { nombre: 'Huitlacoche', extra: 15 },
  { nombre: 'Extra de Queso Oaxaca', extra: 0 },
]

// Modificadores de remoción sobre los componentes base (tortilla hecha a
// mano, frijol, salsa verde, romanita, crema, queso oaxaca).
export const MODIFICADORES = [
  'Sin Crema',
  'Sin Frijol',
  'Sin Salsa Verde',
  'Sin Queso Oaxaca',
  'Sin Lechuga (Romanita)',
]

function tiers(base, extra) {
  // base: precio "sencillo" (0 ingredientes). extra: [precio1, precio2, precio3?]
  const list = [{ ingredientes: 0, nombre: 'Sencillo', precio: base }]
  extra.forEach((precio, i) => {
    const n = i + 1
    list.push({ ingredientes: n, nombre: `${n} Ingrediente${n > 1 ? 's' : ''}`, precio })
  })
  return list
}

export const MENU = [
  {
    id: 'sope',
    nombre: 'Sope',
    categoria: 'Sopes',
    base: 'Tortilla hecha a mano, frijol, salsa verde, romanita, crema y queso oaxaca',
    tiers: tiers(110, [140, 165, 190]),
    permiteMitades: true,
    permiteNota: true,
  },
  {
    id: 'quesadilla',
    nombre: 'Quesadilla',
    categoria: 'Quesadillas',
    base: 'Tortilla hecha a mano y queso oaxaca',
    tiers: tiers(120, [140, 165, 190]),
    permiteMitades: true,
    permiteNota: true,
  },
  {
    id: 'tacos-dorados',
    nombre: 'Tacos Dorados',
    categoria: 'Tacos Dorados',
    base: 'Tres tacos dorados, con lechuga, crema y queso',
    tortillas: [
      {
        id: 'maiz',
        nombre: 'Tortilla de Maíz',
        tiers: [
          { ingredientes: 1, nombre: '1 Ingrediente', precio: 150 },
          { ingredientes: 2, nombre: '2 Ingredientes', precio: 175 },
        ],
      },
      {
        id: 'harina',
        nombre: 'Tortilla de Harina',
        tiers: [
          { ingredientes: 1, nombre: '1 Ingrediente', precio: 175 },
          { ingredientes: 2, nombre: '2 Ingredientes', precio: 200 },
        ],
      },
    ],
    permiteMitades: true,
    permiteNota: true,
  },
  {
    id: 'torta',
    nombre: 'Torta',
    categoria: 'Tortas',
    base: 'Pan de torta, frijol, crema, queso oaxaca y verduras',
    tiers: [
      { ingredientes: 1, nombre: '1 Ingrediente', precio: 160 },
      { ingredientes: 2, nombre: '2 Ingredientes', precio: 190 },
      { ingredientes: 3, nombre: '3 Ingredientes', precio: 220 },
    ],
    permiteMitades: true,
    permiteNota: true,
  },
  {
    id: 'sincronizada',
    nombre: 'Sincronizada',
    categoria: 'Sincronizadas',
    base: 'Dos tortillas de harina con queso oaxaca',
    tiers: tiers(110, [130, 155, 180]),
    permiteMitades: true,
    permiteNota: true,
  },
  {
    id: 'burrita',
    nombre: 'Burrita',
    categoria: 'Burritas',
    base: 'Tortilla de harina, frijol, crema y queso oaxaca',
    tiers: tiers(120, [140, 165, 190]),
    permiteMitades: true,
    permiteNota: true,
  },
  {
    id: 'ensalada',
    nombre: 'Ensalada',
    categoria: 'Ensaladas',
    base: 'Lechuga romanita, jitomate, aderezo de la casa',
    tiers: [
      { ingredientes: 1, nombre: '1 Ingrediente', precio: 150 },
      { ingredientes: 2, nombre: '2 Ingredientes', precio: 180 },
    ],
    permiteMitades: false,
    permiteNota: true,
  },
  {
    id: 'bebida',
    nombre: 'Refresco',
    categoria: 'Bebidas',
    base: 'Bebida embotellada',
    tiers: [{ ingredientes: 0, nombre: 'Único', precio: 40 }],
    permiteMitades: false,
    permiteNota: false,
  },
  {
    id: 'flan',
    nombre: 'Flan de Queso Oaxaca',
    categoria: 'Postres',
    base: 'Postre individual',
    tiers: [{ ingredientes: 0, nombre: 'Único', precio: 70 }],
    permiteMitades: false,
    permiteNota: false,
  },
]

export const CATEGORIAS = [...new Set(MENU.map(p => p.categoria))]
