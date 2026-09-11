import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { uid } from '../lib/utils'
import { firma } from '../lib/bitacora'
import { usePosStore } from '../store/appStore'

/** CRUD del menú desde el panel de admin: platillos, ingredientes y modificadores.
 *  - Platillos viven en la tabla COMPARTIDA `platillos` (con tali). Sus escrituras
 *    van por RPCs SECURITY DEFINER (pos_guardar_platillo / pos_borrar_platillo), no
 *    directo, para no abrir esa tabla a la anon key (ver supabase/admin_menu.sql).
 *  - Ingredientes, modificadores, extras y el orden de categorías son 100% del POS
 *    (tablas pos_*). También van por RPC: la escritura directa no dejaba rastro de
 *    quién hizo cada cambio (ver supabase/bitacora.sql), y su RLS es de solo lectura.
 *  En modo mock todo muta el store; en backend usePosData recarga por Realtime. */
export function useMenuAdmin() {
  const platillos = usePosStore((s) => s.platillos)
  const ingredientes = usePosStore((s) => s.ingredientes)
  const modificadores = usePosStore((s) => s.modificadores)
  const extras = usePosStore((s) => s.extras)
  const categoriasOrden = usePosStore((s) => s.categoriasOrden)
  const setPlatillos = usePosStore((s) => s.setPlatillos)
  const setIngredientes = usePosStore((s) => s.setIngredientes)
  const setModificadores = usePosStore((s) => s.setModificadores)
  const setExtras = usePosStore((s) => s.setExtras)
  const setCategoriasOrden = usePosStore((s) => s.setCategoriasOrden)
  const restauranteId = usePosStore((s) => s.restauranteId)

  // ── Platillos ──────────────────────────────────────────────────────────────
  // p (forma de la app): { id?, nombre, categoria, base, tiers, tortillas?,
  //                        permiteMitades, permiteNota, activo }
  function guardarPlatillo(p) {
    if (IS_MOCK) {
      if (p.id && platillos.some((x) => x.id === p.id)) {
        setPlatillos(platillos.map((x) => (x.id === p.id ? { ...x, ...p } : x)))
      } else {
        // Platillo nuevo: se agrega al final de su categoría.
        const orden = platillos.filter((x) => x.categoria === p.categoria).length
        setPlatillos([...platillos, { id: uid('plat'), activo: true, orden, ...p }])
      }
      return Promise.resolve({ error: null })
    }
    return sb
      .rpc('pos_guardar_platillo', {
        p_id: p.id ?? null,
        p_restaurante_id: restauranteId,
        p_nombre: p.nombre?.trim(),
        p_categoria: p.categoria?.trim() || null,
        p_base: p.base?.trim() || null,
        p_tiers: p.tiers ?? [],
        p_permite_mitades: !!p.permiteMitades,
        p_permite_nota: !!p.permiteNota,
        p_activo: p.activo !== false,
        p_tortillas: p.tortillas ?? null,
        p_modificadores: p.modificadores ?? [],
        p_extras: p.extras ?? [],
        p_orden: p.orden ?? null,
        ...firma(),
      })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  // Reordenar platillos: recibe los ids en el orden deseado (normalmente los de una
  // sola categoría) y les asigna orden = posición.
  function reordenarPlatillos(orderedIds) {
    if (IS_MOCK) {
      const rank = new Map(orderedIds.map((id, i) => [id, i]))
      setPlatillos(platillos.map((p) => (rank.has(p.id) ? { ...p, orden: rank.get(p.id) } : p)))
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_reordenar_platillos', { p_ids: orderedIds, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // Reordenar categorías: recibe los NOMBRES en el orden deseado y persiste orden = posición.
  function reordenarCategorias(orderedNombres) {
    if (IS_MOCK) {
      const previa = new Map(categoriasOrden.map((c) => [c.nombre, c]))
      setCategoriasOrden(orderedNombres.map((nombre, i) => ({ id: previa.get(nombre)?.id ?? uid('cat'), nombre, orden: i })))
      return Promise.resolve({ error: null })
    }
    return sb
      .rpc('pos_reordenar_categorias', { p_restaurante_id: restauranteId, p_nombres: orderedNombres, ...firma() })
      .then(({ error }) => ({ error: error?.message ?? null }))
  }

  function borrarPlatillo(id) {
    if (IS_MOCK) {
      setPlatillos(platillos.filter((x) => x.id !== id))
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_borrar_platillo', { p_id: id, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // ── Ingredientes ───────────────────────────────────────────────────────────
  // i: { id?, nombre, extra, activo, orden }
  function guardarIngrediente(i) {
    if (IS_MOCK) {
      if (i.id && ingredientes.some((x) => x.id === i.id)) {
        setIngredientes(ingredientes.map((x) => (x.id === i.id ? { ...x, ...i } : x)))
      } else {
        setIngredientes([...ingredientes, { id: uid('ing'), activo: true, orden: ingredientes.length, ...i }])
      }
      return Promise.resolve({ error: null })
    }
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
    if (IS_MOCK) {
      setIngredientes(ingredientes.filter((x) => x.id !== id))
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_borrar_ingrediente', { p_id: id, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // ── Modificadores ──────────────────────────────────────────────────────────
  // m: { id?, nombre, activo, orden }
  function guardarModificador(m) {
    if (IS_MOCK) {
      if (m.id && modificadores.some((x) => x.id === m.id)) {
        setModificadores(modificadores.map((x) => (x.id === m.id ? { ...x, ...m } : x)))
      } else {
        setModificadores([...modificadores, { id: uid('mod'), activo: true, orden: modificadores.length, ...m }])
      }
      return Promise.resolve({ error: null })
    }
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
    if (IS_MOCK) {
      setModificadores(modificadores.filter((x) => x.id !== id))
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_borrar_modificador', { p_id: id, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // ── Extras (pos_extras) ─────────────────────────────────────────────────────
  // e: { id?, nombre, precio, activo, orden }
  function guardarExtra(e) {
    if (IS_MOCK) {
      if (e.id && extras.some((x) => x.id === e.id)) {
        setExtras(extras.map((x) => (x.id === e.id ? { ...x, ...e } : x)))
      } else {
        setExtras([...extras, { id: uid('ext'), activo: true, orden: extras.length, ...e }])
      }
      return Promise.resolve({ error: null })
    }
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
    if (IS_MOCK) {
      setExtras(extras.filter((x) => x.id !== id))
      return Promise.resolve({ error: null })
    }
    return sb.rpc('pos_borrar_extra', { p_id: id, ...firma() }).then(({ error }) => ({ error: error?.message ?? null }))
  }

  // Fija a qué platillos aplica un extra (edición desde el lado del extra): lo agrega
  // a los platillos de `platilloIds` y lo quita de los demás. Si `oldNombre` difiere
  // (renombre), primero limpia el nombre viejo de todos.
  function asignarExtraAProductos(nombre, platilloIds, oldNombre) {
    const idset = new Set(platilloIds)
    if (IS_MOCK) {
      setPlatillos(platillos.map((p) => {
        let ex = p.extras ?? []
        if (oldNombre && oldNombre !== nombre) ex = ex.filter((n) => n !== oldNombre)
        if (idset.has(p.id)) ex = ex.includes(nombre) ? ex : [...ex, nombre]
        else ex = ex.filter((n) => n !== nombre)
        return { ...p, extras: ex }
      }))
      return Promise.resolve({ error: null })
    }
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
    guardarModificador, borrarModificador,
    guardarExtra, borrarExtra, asignarExtraAProductos,
  }
}
