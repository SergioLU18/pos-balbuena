// esAdmin: un mesero administrador puede entrar a /admin y editar a los demás
// meseros y el menú. Sigue siendo "atribución, no seguridad" (ver MeseroSwitcher):
// el gate es el mismo PIN de 4 dígitos, no un login real.
export const MESEROS = [
  { id: 'mesero-1', nombre: 'Doña Rosa', mesas: ['1', '2', '3', '4', '5'], pin: '1111', esAdmin: true },
  { id: 'mesero-2', nombre: 'Don Beto', mesas: ['6', '7', '8', '9', '10'], pin: '2222', esAdmin: false },
  { id: 'mesero-3', nombre: 'Lupita', mesas: ['11', '12', '13', '14', '15'], pin: '3333', esAdmin: false },
]
