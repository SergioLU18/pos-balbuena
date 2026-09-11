import { f } from './utils'

/** Traducción de la bitácora (tabla pos_eventos, ver supabase/bitacora.sql) a texto
 *  para Ajustes → Bitácora. Todo aquí es puro: recibe un evento ya mapeado a camelCase
 *  ({ accion, entidad, etiqueta, detalle, … }) y devuelve strings o números, para
 *  poder probarlo sin React ni Supabase.
 *
 *  El vocabulario de `accion` vive en bitacora.sql. Si allá se agrega una acción y aquí
 *  no, la pantalla la muestra tal cual ("mesa.fusionar") en vez de romperse. */

export const GRUPOS = {
  operacion: { nombre: 'Operación', color: 'var(--jb-pink)' },
  menu: { nombre: 'Menú', color: 'var(--jb-teal)' },
  config: { nombre: 'Configuración', color: 'var(--jb-info)' },
}

const GRUPO_DE = {
  'orden.enviar': 'operacion',
  'item.editar': 'operacion',
  'item.eliminar': 'operacion',
  'cocina.estado': 'operacion',
  'mesa.cerrar': 'operacion',
  'mesa.unir': 'operacion',
  'mesa.separar': 'operacion',
  'llevar.crear': 'operacion',
  'llevar.cerrar': 'operacion',
  'cliente.guardar': 'operacion',

  'platillo.crear': 'menu',
  'platillo.editar': 'menu',
  'platillo.borrar': 'menu',
  'platillo.reordenar': 'menu',
  'extra.platillos': 'menu',
  'ingrediente.crear': 'menu',
  'ingrediente.editar': 'menu',
  'ingrediente.borrar': 'menu',
  'modificador.crear': 'menu',
  'modificador.editar': 'menu',
  'modificador.borrar': 'menu',
  'extra.crear': 'menu',
  'extra.editar': 'menu',
  'extra.borrar': 'menu',
  'categoria.reordenar': 'menu',

  'mesa.crear': 'config',
  'mesa.renombrar': 'config',
  'mesa.borrar': 'config',
  'mesa.reordenar': 'config',
  'mesero.crear': 'config',
  'mesero.editar': 'config',
  'mesero.baja': 'config',
  'mesero.mesas': 'config',
}

export const ACCIONES = Object.keys(GRUPO_DE)

export function grupoDe(accion) {
  return GRUPO_DE[accion] ?? null
}

/** Las acciones de un grupo, para filtrar la consulta con `.in('accion', …)`. */
export function accionesDelGrupo(grupo) {
  return ACCIONES.filter((a) => GRUPO_DE[a] === grupo)
}

// Columnas del tablero de cocina con el nombre que ve el personal, no el del dato.
const COLUMNA = { pendiente: 'Nuevo', preparando: 'Preparando', listo: 'Listo', entregado: 'Entregado' }

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
// Piezas y no renglones: "2× Sope + 1× Huarache" son 3 platillos para quien lee,
// aunque en el dato sean 2 renglones.
const piezas = (items) => (items ?? []).reduce((s, r) => s + (Number(r?.cantidad) || 0), 0)
const num = (x) => (x == null ? null : Number(x))

/** Sobre qué cayó la acción, listo para pintarse: "Mesa 7", "L-14", "Huarache"… */
export function sujeto(ev) {
  const { entidad, etiqueta, accion, detalle = {} } = ev
  if (!etiqueta) return null
  if (entidad === 'mesa') return `Mesa ${etiqueta}`
  // En los eventos de comanda la etiqueta es el número de mesa O el nombre del
  // cliente para llevar; `tipo` es lo que dice cuál de los dos es.
  if (entidad === 'pedido') {
    if (detalle.tipo === 'llevar') return `Para llevar · ${etiqueta}`
    if (detalle.tipo === 'mesa') return `Mesa ${etiqueta}`
    return etiqueta
  }
  if (accion === 'platillo.reordenar') return `Categoría ${etiqueta}`
  return etiqueta
}

// Resume un antes/después en lo que de verdad cambió. Si no hay nada concreto que
// decir (se guardó el formulario sin tocar nada, o cambió algo que no se resume aquí)
// cae en el genérico "Editó …" — el detalle expandido sigue mostrando todo.
function cambiosCatalogo(d, campoPrecio, que) {
  const a = d.antes ?? {}
  const b = d.despues ?? {}
  const partes = []
  if (a.nombre != null && a.nombre !== b.nombre) partes.push(`le cambió el nombre (antes “${a.nombre}”)`)
  if (campoPrecio && a[campoPrecio] != null && Number(a[campoPrecio]) !== Number(b[campoPrecio])) {
    partes.push(`cambió el precio de ${f(a[campoPrecio])} a ${f(b[campoPrecio])}`)
  } else if (a.tiers && b.tiers && JSON.stringify(a.tiers) !== JSON.stringify(b.tiers)) {
    partes.push('cambió sus precios por nivel')
  }
  if (a.categoria !== undefined && a.categoria !== b.categoria) partes.push(`lo movió a ${b.categoria ?? 'sin categoría'}`)
  if (a.activo != null && a.activo !== b.activo) partes.push(b.activo ? 'lo volvió a activar' : 'lo desactivó')
  return partes.length ? cap(partes.join(', ')) : `Editó ${que}`
}

function cambiosMesero(d) {
  const a = d.antes ?? {}
  const b = d.despues ?? {}
  const partes = []
  if (a.nombre != null && a.nombre !== b.nombre) partes.push(`le cambió el nombre (antes “${a.nombre}”)`)
  if (a.es_admin != null && a.es_admin !== b.es_admin) {
    partes.push(b.es_admin ? 'le dio permisos de admin' : 'le quitó los permisos de admin')
  }
  if (d.cambio_pin) partes.push('le cambió el PIN')
  if (a.activo != null && a.activo !== b.activo) partes.push(b.activo ? 'lo reactivó' : 'lo desactivó')
  return partes.length ? cap(partes.join(', ')) : 'Editó al mesero'
}

/** Qué pasó, en una frase. */
export function describir(ev) {
  const d = ev.detalle ?? {}
  switch (ev.accion) {
    case 'orden.enviar': return `Mandó ${plural(piezas(d.items), 'platillo', 'platillos')} a cocina`
    case 'item.editar': return `Cambió ${d.platillo} de ${d.de} a ${d.a}`
    case 'item.eliminar': return `Quitó ${d.cantidad}× ${d.platillo} ya enviado`
    case 'cocina.estado': return `Movió la comanda de ${COLUMNA[d.de] ?? d.de} a ${COLUMNA[d.a] ?? d.a}`
    case 'mesa.cerrar': return d.comandas ? `Cerró la cuenta (${plural(d.comandas, 'comanda', 'comandas')})` : 'Cerró la cuenta'
    // El sujeto es la principal ("Mesa 3"); la secundaria va en la frase. El dinero que
    // pasa de una cuenta a otra no es venta nueva, por eso va aquí y no en importe().
    case 'mesa.unir': return Number(d.importe) > 0
      ? `Le unió la Mesa ${d.secundaria} y pasó su cuenta de ${f(d.importe)}`
      : `Le unió la Mesa ${d.secundaria}`
    case 'mesa.separar': return `Le separó la Mesa ${d.secundaria}`

    case 'mesa.crear': return 'Creó la mesa'
    case 'mesa.renombrar': return `Renombró la mesa: ${d.de} → ${d.a}`
    case 'mesa.borrar': return 'Dio de baja la mesa'
    case 'mesa.reordenar': return 'Reordenó el listado de mesas'

    case 'mesero.crear': return d.es_admin ? 'Dio de alta al mesero (admin)' : 'Dio de alta al mesero'
    case 'mesero.editar': return cambiosMesero(d)
    case 'mesero.baja': return 'Dio de baja al mesero'
    case 'mesero.mesas': return `Cambió sus mesas: ${d.antes?.length ?? 0} → ${d.despues?.length ?? 0}`

    case 'llevar.crear': return 'Abrió la orden para llevar'
    case 'llevar.cerrar': return d.estado === 'cancelada' ? 'Canceló la orden para llevar' : 'Entregó la orden para llevar'
    case 'cliente.guardar': return d.alta ? 'Dio de alta al cliente' : 'Editó los datos del cliente'

    case 'platillo.crear': return 'Agregó el platillo al menú'
    case 'platillo.editar': return cambiosCatalogo(d, 'precio', 'el platillo')
    case 'platillo.borrar': return 'Borró el platillo del menú'
    case 'platillo.reordenar': return 'Reordenó los platillos'
    case 'extra.platillos': return `Cambió a qué platillos aplica (${d.platillos ?? 0})`

    case 'ingrediente.crear': return 'Agregó el ingrediente'
    case 'ingrediente.editar': return cambiosCatalogo(d, 'extra', 'el ingrediente')
    case 'ingrediente.borrar': return 'Borró el ingrediente'
    case 'modificador.crear': return 'Agregó el modificador'
    case 'modificador.editar': return cambiosCatalogo(d, null, 'el modificador')
    case 'modificador.borrar': return 'Borró el modificador'
    case 'extra.crear': return 'Agregó el extra'
    case 'extra.editar': return cambiosCatalogo(d, 'precio', 'el extra')
    case 'extra.borrar': return 'Borró el extra'
    case 'categoria.reordenar': return 'Reordenó las categorías'

    default: return ev.accion
  }
}

/** Dinero asociado al evento, con signo: lo que se quitó de una cuenta va negativo.
 *  null cuando la acción no mueve dinero. */
export function importe(ev) {
  const d = ev.detalle ?? {}
  switch (ev.accion) {
    case 'orden.enviar': return num(d.importe)
    case 'item.eliminar': return d.importe == null ? null : -Number(d.importe)
    case 'mesa.cerrar':
    case 'llevar.cerrar': return num(d.total)
    default: return null
  }
}

/** Lo que conviene encontrar de un vistazo: quita dinero de una cuenta, borra algo, o
 *  toca precios o permisos. No es un juicio sobre quien lo hizo — casi siempre hay una
 *  buena razón —; es lo primero que se revisa cuando algo no cuadra al cierre. */
export function esSensible(ev) {
  const d = ev.detalle ?? {}
  switch (ev.accion) {
    case 'item.eliminar':
    case 'platillo.borrar':
    case 'extra.borrar':
    case 'ingrediente.borrar':
    case 'modificador.borrar':
    case 'mesero.baja':
      return true
    case 'item.editar': return Number(d.a) < Number(d.de)
    case 'llevar.cerrar': return d.estado === 'cancelada'
    case 'platillo.editar':
    case 'extra.editar':
      return !!d.cambio_precio
    case 'ingrediente.editar':
      return d.antes?.extra != null && Number(d.antes.extra) !== Number(d.despues?.extra)
    case 'mesero.editar':
      return !!d.cambio_pin || (d.antes?.es_admin != null && d.antes.es_admin !== d.despues?.es_admin)
    default:
      return false
  }
}

/** Los platillos que trae el evento, para el detalle expandido. */
export function renglones(ev) {
  const d = ev.detalle ?? {}
  if (Array.isArray(d.items)) return d.items
  if (d.item) return [d.item]
  return []
}
