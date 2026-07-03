import { MENU, CATEGORIAS, INGREDIENTES, MODIFICADORES } from '../lib/mockMenu'

/** Catálogo de platillos de Jardín Balbuena. */
export function useMenu() {
  return { menu: MENU, categorias: CATEGORIAS, ingredientes: INGREDIENTES, modificadores: MODIFICADORES }
}
