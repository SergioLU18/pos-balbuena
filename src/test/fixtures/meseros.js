// esAdmin: un mesero administrador puede entrar a /admin y editar a los demás
// meseros y el menú. Sigue siendo "atribución, no seguridad" (ver MeseroSwitcher):
// el gate es el mismo PIN de 4 dígitos, no un login real.
//
// No hay reparto de mesas: cualquier mesero atiende cualquier mesa.
export const MESEROS = [
  { id: 'mesero-1', nombre: 'Doña Rosa', pin: '1111', esAdmin: true },
  { id: 'mesero-2', nombre: 'Don Beto', pin: '2222', esAdmin: false },
  { id: 'mesero-3', nombre: 'Lupita', pin: '3333', esAdmin: false },
]
