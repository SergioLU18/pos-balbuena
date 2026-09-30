import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'
import { reiniciarSb, RESTAURANTE_ID } from './sbFalso'
import { usePosStore, useMeseroStore } from '../store/appStore'
import { MESAS } from './fixtures/mesas'
import { MESEROS } from './fixtures/meseros'
import { MENU, INGREDIENTES, MODIFICADORES, EXTRAS } from './fixtures/menu'

// Ningún test habla con Supabase: todos reciben el cliente falso (ver sbFalso.js).
vi.mock('../lib/supabase', () => import('./sbFalso'))

// Catálogo en la forma en que usePosData lo deja en el store tras cargar de Supabase.
// orden: posición del platillo dentro de su categoría (hay uno por categoría, así que 0).
const PLATILLOS = MENU.map((p) => ({ activo: true, orden: 0, ...p }))
const ING = INGREDIENTES.map((x, i) => ({ id: `ing-${i}`, activo: true, orden: i, ...x }))
const MODS = MODIFICADORES.map((nombre, i) => ({ id: `mod-${i}`, nombre, activo: true, orden: i }))
const EXT = EXTRAS.map((x, i) => ({ id: `ext-${i}`, activo: true, orden: i, ...x }))
const CATEGORIAS = [...new Set(MENU.map((p) => p.categoria))].map((nombre, i) => ({ id: `cat-${i}`, nombre, orden: i }))

// Cada test arranca como una tablet recién cargada: catálogo completo, el primer mesero
// en sesión y el backend contestando OK a todo.
beforeEach(() => {
  reiniciarSb()
  usePosStore.setState({
    mesas: MESAS,
    meseros: MESEROS,
    platillos: PLATILLOS,
    ingredientes: ING,
    modificadores: MODS,
    extras: EXT,
    categoriasOrden: CATEGORIAS,
    restauranteId: RESTAURANTE_ID,
  })
  useMeseroStore.setState({ currentMeseroId: MESEROS[0].id })
})
