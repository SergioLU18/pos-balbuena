// El cliente del padrón para llevar guarda el nombre y la dirección en columnas
// separadas (ver supabase/llevar.sql), pero casi toda la UI los necesita como una
// sola línea de texto. Estos helpers arman esa línea en un solo lugar.

export function nombreCompleto(c) {
  return [c?.nombre, c?.apellidos].filter(Boolean).join(' ').trim()
}

// `cruzamientos` es la única parte de la dirección que es opcional — no siempre
// se conoce, y no debe dejar un "esq. " colgando si falta.
export function formatearDireccion(c) {
  if (!c) return ''
  const calleNumero = [c.calle, c.numero].filter(Boolean).join(' ')
  const partes = [
    calleNumero,
    c.cruzamientos ? `esq. ${c.cruzamientos}` : null,
    c.colonia,
    c.codigoPostal ? `CP ${c.codigoPostal}` : null,
  ].filter(Boolean)
  return partes.join(', ')
}

// Formatea una fecha "YYYY-MM-DD" (columna `date`, sin hora) sin pasar por
// `new Date(iso)`: eso interpreta la fecha en UTC y en un huso horario detrás de
// UTC (México) puede correr el cumpleaños un día hacia atrás.
export function formatearCumpleanos(fechaISO) {
  if (!fechaISO) return ''
  const [y, m, d] = fechaISO.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatearGenero(genero) {
  if (genero === 'hombre') return 'Hombre'
  if (genero === 'mujer') return 'Mujer'
  return ''
}
