/** Mesas unidas: cuando en el salón juntan dos mesas físicas para un grupo grande.
 *
 *  El modelo es el de tali (`mesas.joined_to`): la mesa SECUNDARIA apunta a su
 *  PRINCIPAL, y todo — cuenta, comandas, órdenes nuevas — vive en la principal. Es de un
 *  solo nivel: una principal no puede estar unida a otra, ni una secundaria tener
 *  secundarias propias. Estas reglas son el espejo de las que valida pos_unir_mesas en
 *  el servidor; aquí sirven para apagar en pantalla lo que de todos modos se rechazaría.
 *
 *  Funciones puras sobre la lista de mesas (con `joined_to` tal como viene de la base). */

/** Las mesas unidas a `mesaId`, en el orden del listado. */
export function secundariasDe(mesas, mesaId) {
  return mesas.filter((m) => m.joined_to === mesaId)
}

/** Nombre del grupo para encabezados y tarjetas: "3 + 4 + 5". */
export function nombreGrupo(numero, secundarias = []) {
  return [numero, ...secundarias.map((s) => s.numero)].join(' + ')
}

/** Una secundaria no puede hacer de principal: el grupo ya tiene una. */
export function puedeSerPrincipal(mesa) {
  return !mesa.joined_to
}

/** Si `mesa` se puede sumar al grupo de `principalId`: no es la principal misma, no
 *  está ya unida a otra, y no es a su vez principal de otro grupo (eso haría cadenas). */
export function puedeUnirse(mesas, mesa, principalId) {
  return mesa.id !== principalId && !mesa.joined_to && !mesas.some((m) => m.joined_to === mesa.id)
}
