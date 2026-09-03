import { usePosStore } from '../store/appStore'

/** Catálogo de platillos de Jardín Balbuena para el flujo de orden del mesero.
 *  La fuente de verdad es usePosStore (mock: catálogo estático; backend: Supabase,
 *  vía usePosData). Aquí se filtran los inactivos, se ordenan (categorías por
 *  categoriasOrden; platillos por su `orden` dentro de la categoría) y se aplanan
 *  ingredientes/modificadores/extras a la forma que consumen los componentes de orden.
 *  El editor de menú (admin) lee los objetos completos del store, no este hook. */
export function useMenu() {
  const platillos = usePosStore((s) => s.platillos)
  const ingredientes = usePosStore((s) => s.ingredientes)
  const modificadores = usePosStore((s) => s.modificadores)
  const extras = usePosStore((s) => s.extras)
  const categoriasOrden = usePosStore((s) => s.categoriasOrden)

  // Rango de una categoría: su `orden` en el catálogo; las que no estén, al final.
  const rangoCat = new Map(categoriasOrden.map((c) => [c.nombre, c.orden]))
  const catRank = (nombre) => (rangoCat.has(nombre) ? rangoCat.get(nombre) : Number.MAX_SAFE_INTEGER)

  const menu = platillos
    .filter((p) => p.activo !== false)
    .slice()
    .sort((a, b) =>
      catRank(a.categoria) - catRank(b.categoria) ||
      (a.orden ?? 0) - (b.orden ?? 0) ||
      a.nombre.localeCompare(b.nombre),
    )

  // `menu` ya viene ordenado por categoría, así que las categorías únicas salen en orden.
  const categorias = [...new Set(menu.map((p) => p.categoria))]

  return {
    menu,
    categorias,
    ingredientes: ingredientes.filter((i) => i.activo !== false).map(({ nombre, extra }) => ({ nombre, extra })),
    modificadores: modificadores.filter((m) => m.activo !== false).map((m) => m.nombre),
    extras: extras.filter((e) => e.activo !== false).map(({ nombre, precio }) => ({ nombre, precio })),
  }
}
