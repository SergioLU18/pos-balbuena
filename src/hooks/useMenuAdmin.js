import { sb } from '../lib/supabase'
import { firma } from '../lib/bitacora'
import { usePosStore } from '../store/appStore'

/** CRUD del menú desde el panel de admin: platillos, ingredientes y modificadores.
 *  - Platillos viven en la tabla COMPARTIDA `platillos` (con tali). Sus escrituras
 *    van por RPCs SECURITY DEFINER (pos_guardar_platillo / pos_borrar_platillo), no
 *    directo, para no abrir esa tabla a la anon key (ver supabase/admin_menu.sql).
 *  - Ingredientes, modificadores, extras y el orden de categorías son 100% del POS
 *    (tablas pos_*). También van por RPC: la escritura directa no dejaba rastro de
 *    quién hizo cada cambio (ver supabase/bitacora.sql), y su RLS es de solo lectura.
 *  El store no se toca aquí: usePosData recarga por Realtime tras cada cambio. */
export function useMenuAdmin() {
  const restauranteId = usePosStore((s) => s.restauranteId)

  // ── Platillos ──────────────────────────────────────────────────────────────
  // p (forma de la app): { id?, nombre, categoria, base, tiers, tortillas?,
  //                        permiteNota, activo, tiempoPrepMin }
  function guardarPlatillo(p) {
    return sb
      .rpc('pos_guardar_platillo', {
        p_id: p.id ?? null,
        p_restaurante_id: restauranteId,
        p_nombre: p.nombre?.trim(),
        p_categoria: p.categoria?.trim() || null,
        p_base: p.base?.trim() || null,
        p_tiers: p.tiers ?? [],
        // El plato ya no se puede dividir en mitades; queda fijo en false (la columna
        // sigue en la base, pero ningún flujo del POS vuelve a leerla ni a ofrecerla).
        p_permite_mitades: false,
        p_permite_nota: !!p.permiteNota,
        p_activo: p.activo !== false,
        p_tortillas: p.tortillas ?? null,
        p_modificadores: p.modificadores ?? [],
        p_extras: p.extras ?? [],
        p_orden: p.orden ?? null,
        p_tiempo_prep_min: Number(p.tiempoPrepMin) || 5,
        p_usa_modificadores: p.usaModificadores !== false,
        p_usa_extras: p.usaExtras !== false,
        ...firma(),
      })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  // Reordenar platillos: recibe los ids en el orden deseado (normalmente los de una
  // sola categoría) y les asigna orden = posición.
  function reordenarPlatillos(orderedIds) {
    return sb.rpc('pos_reordenar_platillos', { p_ids: orderedIds, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // Reordenar categorías: recibe los NOMBRES en el orden deseado y persiste orden = posición.
  function reordenarCategorias(orderedNombres) {
    return sb
      .rpc('pos_reordenar_categorias', { p_restaurante_id: restauranteId, p_nombres: orderedNombres, ...firma() })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  function borrarPlatillo(id) {
    return sb.rpc('pos_borrar_platillo', { p_id: id, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // ── Ingredientes ───────────────────────────────────────────────────────────
  // i: { id?, nombre, extra, activo, orden }
  function guardarIngrediente(i) {
    return sb
      .rpc('pos_guardar_ingrediente', {
        p_id: i.id ?? null,
        p_restaurante_id: restauranteId,
        p_nombre: i.nombre?.trim(),
        p_extra: Number(i.extra) || 0,
        p_activo: i.activo !== false,
        p_orden: i.orden ?? null,
        ...firma(),
      })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  function borrarIngrediente(id) {
    return sb.rpc('pos_borrar_ingrediente', { p_id: id, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // ── Modificadores ──────────────────────────────────────────────────────────
  // m: { id?, nombre, activo, orden }
  function guardarModificador(m) {
    return sb
      .rpc('pos_guardar_modificador', {
        p_id: m.id ?? null,
        p_restaurante_id: restauranteId,
        p_nombre: m.nombre?.trim(),
        p_activo: m.activo !== false,
        p_orden: m.orden ?? null,
        ...firma(),
      })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  function borrarModificador(id) {
    return sb.rpc('pos_borrar_modificador', { p_id: id, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // Reordenar modificadores: recibe los ids en el orden deseado y les asigna orden = posición.
  function reordenarModificadores(orderedIds) {
    return sb.rpc('pos_reordenar_modificadores', { p_ids: orderedIds, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // ── Extras (pos_extras) ─────────────────────────────────────────────────────
  // e: { id?, nombre, precio, activo, orden }
  function guardarExtra(e) {
    return sb
      .rpc('pos_guardar_extra', {
        p_id: e.id ?? null,
        p_restaurante_id: restauranteId,
        p_nombre: e.nombre?.trim(),
        p_precio: Number(e.precio) || 0,
        p_activo: e.activo !== false,
        p_orden: e.orden ?? null,
        ...firma(),
      })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  function borrarExtra(id) {
    return sb.rpc('pos_borrar_extra', { p_id: id, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // Reordenar extras: recibe los ids en el orden deseado y les asigna orden = posición.
  function reordenarExtras(orderedIds) {
    return sb.rpc('pos_reordenar_extras', { p_ids: orderedIds, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // Fija a qué platillos aplica un extra (edición desde el lado del extra): lo agrega
  // a los platillos de `platilloIds` y lo quita de los demás. Si `oldNombre` difiere
  // (renombre), primero limpia el nombre viejo de todos.
  function asignarExtraAProductos(nombre, platilloIds, oldNombre) {
    return sb
      .rpc('pos_set_extra_en_platillos', {
        p_restaurante_id: restauranteId,
        p_extra: nombre,
        p_platillo_ids: platilloIds,
        p_old_extra: oldNombre && oldNombre !== nombre ? oldNombre : null,
        ...firma(),
      })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  return {
    guardarPlatillo, borrarPlatillo, reordenarPlatillos, reordenarCategorias,
    guardarIngrediente, borrarIngrediente,
    guardarModificador, borrarModificador, reordenarModificadores,
    guardarExtra, borrarExtra, asignarExtraAProductos, reordenarExtras,
  }
}
