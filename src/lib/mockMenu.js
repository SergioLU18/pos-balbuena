// Catálogo de Jardín Balbuena, tomado 1:1 del menú y del sistema de personalización
// real de la sucursal Av. Líbano (balbuena.app/libano, modal de cada platillo).
// Precios en MXN.
//
// Modelo de personalización (igual que el sitio):
//  - ingredientes: elección de guiso, con tope = nivel del platillo. Catálogo global;
//    se muestran cuando el nivel elegido permite >0.
//  - modificadores: remociones gratis ("Sin X"). Catálogo global, pero cada platillo
//    declara CUÁLES aplican (una quesadilla no tiene frijol que quitar). -> p.modificadores
//  - extras: agregados de PAGO. Catálogo global, y cada platillo declara cuáles aplican
//    (las bebidas y el postre no llevan los extras de comida). -> p.extras

// Guisos elegibles. La mayoría sin cargo; tres cuestan +$15.
export const INGREDIENTES = [
  { nombre: 'Aguacate', extra: 0 },
  { nombre: 'Asado', extra: 0 },
  { nombre: 'Asado Rojo', extra: 0 },
  { nombre: 'Champiñones', extra: 0 },
  { nombre: 'Chicharrón Prensado', extra: 0 },
  { nombre: 'Chorizo', extra: 0 },
  { nombre: 'Empanizado de Pollo', extra: 15 },
  { nombre: 'Extra de Queso Oaxaca', extra: 0 },
  { nombre: 'Huitlacoche', extra: 15 },
  { nombre: 'Jamón', extra: 0 },
  { nombre: 'Papa', extra: 0 },
  { nombre: 'Pollo Deshebrado', extra: 0 },
  { nombre: 'Rajas Poblanas', extra: 0 },
  { nombre: 'Tinga de Res', extra: 15 },
]

// Catálogo global de modificadores de remoción ("Personaliza"). Unión de los que usa
// cada platillo; cada platillo elige su subconjunto (ver p.modificadores).
export const MODIFICADORES = [
  'Sin Crema',
  'Sin Frijol',
  'Sin Salsa Verde',
  'Sin Salsa Roja',
  'Sin Queso Oaxaca',
  'Sin Lechuga (Romanita)',
  'Sin Aguacate',
]

// Catálogo global de extras (agregados de pago). Cada platillo elige cuáles aplican
// (ver p.extras). No tienen tope y siempre cuestan.
export const EXTRAS = [
  { nombre: 'Aguacate', precio: 30 },
  { nombre: 'Chile de Árbol', precio: 5 },
  { nombre: 'Chile Habanero', precio: 5 },
  { nombre: 'Crema', precio: 10 },
  { nombre: 'Salsa Verde', precio: 10 },
]

// Todos los platillos de comida ofrecen los mismos 5 extras; bebidas y postre, ninguno.
const EXTRAS_COMIDA = EXTRAS.map((e) => e.nombre)

function tiers(base, extra) {
  // base: precio "sencillo" (0 ingredientes). extra: [precio1, precio2, precio3?]
  const list = [{ ingredientes: 0, nombre: 'Sencillo', precio: base }]
  extra.forEach((precio, i) => {
    const n = i + 1
    list.push({ ingredientes: n, nombre: `${n} Ingrediente${n > 1 ? 's' : ''}`, precio })
  })
  return list
}

// Bebidas: el SABOR se elige como variante (mismo modelo que las tortillas de los tacos),
// todas al mismo precio. Cada sabor es una variante con un único tier ("Único").
const SABORES_BEBIDA = [
  'Coca Cola Regular',
  'Coca Cola Light',
  'Coca Cola Sin Azúcar',
  'Fanta',
  'Cebada',
  'Bebi',
  'Agua de Horchata',
  'Agua de Jamaica',
  'Jamaica con Canela y Limón sin Azúcar',
  'Té Negro Stevia',
  'Agua Purificada',
]
const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const saboresBebida = (precio) =>
  SABORES_BEBIDA.map((nombre) => ({ id: slug(nombre), nombre, tiers: [{ ingredientes: 0, nombre: 'Único', precio }] }))

export const MENU = [
  {
    id: 'sope',
    nombre: 'Sope',
    categoria: 'Sopes',
    base: 'Tortilla hecha a mano, frijol, salsa verde, romanita, crema y queso oaxaca',
    // El sitio real ofrece un "Sencillo con Chorizo" ($120) además del Sencillo ($110):
    // un sope base con chorizo ya incluido (0 ingredientes a elegir).
    tiers: [
      { ingredientes: 0, nombre: 'Sencillo', precio: 110 },
      { ingredientes: 0, nombre: 'Sencillo con Chorizo', precio: 120 },
      { ingredientes: 1, nombre: '1 Ingrediente', precio: 140 },
      { ingredientes: 2, nombre: '2 Ingredientes', precio: 165 },
      { ingredientes: 3, nombre: '3 Ingredientes', precio: 190 },
    ],
    modificadores: ['Sin Crema', 'Sin Frijol', 'Sin Salsa Verde', 'Sin Queso Oaxaca', 'Sin Lechuga (Romanita)'],
    extras: EXTRAS_COMIDA,
    permiteMitades: true,
    permiteNota: true,
  },
  {
    id: 'quesadilla',
    nombre: 'Quesadilla',
    categoria: 'Quesadillas',
    base: 'Tortilla hecha a mano y queso oaxaca',
    tiers: tiers(120, [140, 165, 190]),
    modificadores: ['Sin Crema', 'Sin Salsa Verde'],
    extras: EXTRAS_COMIDA,
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
    modificadores: ['Sin Crema', 'Sin Salsa Verde', 'Sin Queso Oaxaca', 'Sin Lechuga (Romanita)'],
    extras: EXTRAS_COMIDA,
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
    modificadores: ['Sin Aguacate', 'Sin Frijol', 'Sin Crema'],
    extras: EXTRAS_COMIDA,
    permiteMitades: true,
    permiteNota: true,
  },
  {
    id: 'sincronizada',
    nombre: 'Sincronizada',
    categoria: 'Sincronizadas',
    base: 'Dos tortillas de harina con queso oaxaca',
    tiers: tiers(110, [130, 155, 180]),
    modificadores: ['Sin Aguacate', 'Sin Queso Oaxaca', 'Sin Salsa Roja', 'Sin Crema'],
    extras: EXTRAS_COMIDA,
    permiteMitades: true,
    permiteNota: true,
  },
  {
    id: 'burrita',
    nombre: 'Burrita',
    categoria: 'Burritas',
    base: 'Tortilla de harina, frijol, crema y queso oaxaca',
    tiers: tiers(120, [140, 165, 190]),
    modificadores: ['Sin Aguacate', 'Sin Queso Oaxaca', 'Sin Salsa Roja', 'Sin Crema'],
    extras: EXTRAS_COMIDA,
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
    modificadores: ['Sin Salsa Verde', 'Sin Queso Oaxaca', 'Sin Crema'],
    extras: EXTRAS_COMIDA,
    permiteMitades: false,
    permiteNota: true,
  },
  {
    id: 'bebida',
    nombre: 'Refresco',
    categoria: 'Bebidas',
    base: 'Elige tu sabor',
    // El SABOR es la variante (como las tortillas de los tacos): 11 sabores, todos a $40.
    tortillas: saboresBebida(40),
    modificadores: [],
    extras: [],
    permiteMitades: false,
    permiteNota: false,
  },
  {
    id: 'flan',
    nombre: 'Flan de Queso Oaxaca',
    categoria: 'Postres',
    base: 'Postre individual',
    tiers: [{ ingredientes: 0, nombre: 'Único', precio: 70 }],
    modificadores: [],
    extras: [],
    permiteMitades: false,
    permiteNota: false,
  },
]

export const CATEGORIAS = [...new Set(MENU.map(p => p.categoria))]
