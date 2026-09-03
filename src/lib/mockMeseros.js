// esAdmin: un mesero administrador puede entrar a /admin y editar a los demás
// meseros y el menú. Sigue siendo "atribución, no seguridad" (ver MeseroSwitcher):
// el gate es el mismo PIN de 4 dígitos, no un login real.
//
// Qué mesas atiende cada quien NO vive aquí: vive en ASIGNACIONES, porque una mesa
// puede tener varios meseros (ver src/lib/asignaciones.js).
export const MESEROS = [
  { id: 'mesero-1', nombre: 'Doña Rosa', pin: '1111', esAdmin: true },
  { id: 'mesero-2', nombre: 'Don Beto', pin: '2222', esAdmin: false },
  { id: 'mesero-3', nombre: 'Lupita', pin: '3333', esAdmin: false },
]

// Reparto inicial del salón (mesa-1..15 de mockMesas): 5 mesas por mesero. Es solo
// un punto de partida — mandar una orden a una mesa ajena suma al mesero a su lista.
// La mesa 5 arranca compartida entre Doña Rosa y Don Beto a propósito: así el modo
// demo muestra desde el primer render que una mesa admite más de un mesero.
export const ASIGNACIONES = [
  ...['1', '2', '3', '4', '5'].map((n) => ({ mesaId: `mesa-${n}`, meseroId: 'mesero-1' })),
  ...['5', '6', '7', '8', '9', '10'].map((n) => ({ mesaId: `mesa-${n}`, meseroId: 'mesero-2' })),
  ...['11', '12', '13', '14', '15'].map((n) => ({ mesaId: `mesa-${n}`, meseroId: 'mesero-3' })),
]
