// El teléfono es la LLAVE con la que se busca a un cliente para llevar, así que lo que
// se guarda y lo que se compara son siempre los puros dígitos: el mesero lo teclea en un
// teclado numérico y no debe importar si alguien dio de alta al cliente con espacios,
// guiones o lada entre paréntesis. El formato bonito se arma solo al pintarlo.

/** Solo los dígitos de lo que se haya tecleado/guardado. Es la forma canónica. */
export function normalizarTelefono(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

// Largo de un número mexicano a 10 dígitos (lada + número), que es lo que se teclea en
// el mostrador. Números más cortos o más largos se dejan tal cual: mejor mostrarlos
// crudos que agruparlos mal.
const LARGO_MX = 10

/** "5512345678" → "55 1234 5678". Cualquier otro largo se devuelve sin agrupar. */
export function formatearTelefono(valor) {
  const d = normalizarTelefono(valor)
  if (d.length !== LARGO_MX) return d
  return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`
}

/** ¿Alcanza para buscar/dar de alta? Se pide el número completo: buscar con 3 dígitos
 *  traería a medio padrón y daría de alta fichas duplicadas del mismo cliente. */
export function telefonoCompleto(valor) {
  return normalizarTelefono(valor).length === LARGO_MX
}
