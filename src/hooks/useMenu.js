import { usePosStore } from '../store/appStore'

/** Catálogo de platillos de Jardín Balbuena para el flujo de orden del mesero.
 *  La fuente de verdad es usePosStore (mock: catálogo estático; backend: Supabase,
 *  vía usePosData). Aquí solo se filtran los inactivos y se aplanan ingredientes y
 *  modificadores a la forma que consumen los componentes de orden. El editor de
 *  menú (admin) lee los objetos completos del store, no este hook. */
export function useMenu() {
  const platillos = usePosStore((s) => s.platillos)
  const ingredientes = usePosStore((s) => s.ingredientes)
  const modificadores = usePosStore((s) => s.modificadores)
  const extras = usePosStore((s) => s.extras)

  const menu = platillos.filter((p) => p.activo !== false)
  const categorias = [...new Set(menu.map((p) => p.categoria))]

  return {
    menu,
    categorias,
    ingredientes: ingredientes.filter((i) => i.activo !== false).map(({ nombre, extra }) => ({ nombre, extra })),
    modificadores: modificadores.filter((m) => m.activo !== false).map((m) => m.nombre),
    extras: extras.filter((e) => e.activo !== false).map(({ nombre, precio }) => ({ nombre, precio })),
  }
}
