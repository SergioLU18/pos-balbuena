import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { IS_MOCK } from '../lib/config'
import { MESEROS } from '../lib/mockMeseros'
import { MESAS } from '../lib/mockMesas'
import { MENU, INGREDIENTES, MODIFICADORES, EXTRAS } from '../lib/mockMenu'

// Menú inicial para modo mock. platillos ya vienen en la forma que consume la app
// (camelCase); solo se les marca `activo`. Ingredientes, modificadores y extras se
// guardan como objetos con id/activo/orden — así el editor de menú (admin) los puede
// crear/editar/borrar igual en mock que en backend. El flujo de orden los recibe
// aplanados por useMenu (ingredientes {nombre, extra}, modificadores string[],
// extras {nombre, precio}).
// orden: posición del platillo dentro de su categoría (hay un platillo por categoría
// en el mock, así que 0). El orden de categorías vive en categoriasOrden.
const MOCK_PLATILLOS = MENU.map((p) => ({ activo: true, orden: 0, ...p }))
const MOCK_INGREDIENTES = INGREDIENTES.map((x, i) => ({ id: `ing-${i}`, activo: true, orden: i, ...x }))
const MOCK_MODIFICADORES = MODIFICADORES.map((nombre, i) => ({ id: `mod-${i}`, nombre, activo: true, orden: i }))
const MOCK_EXTRAS = EXTRAS.map((x, i) => ({ id: `ext-${i}`, activo: true, orden: i, ...x }))
// Orden de categorías = orden de primera aparición en MENU (Sopes primero).
const MOCK_CATEGORIAS_ORDEN = [...new Set(MENU.map((p) => p.categoria))].map((nombre, i) => ({ id: `cat-${i}`, nombre, orden: i }))

// Envoltura defensiva: en un navegador real localStorage siempre funciona, pero en
// algunos entornos (Safari en modo privado, o el runtime de pruebas) puede no existir
// o no ser funcional — sin esto, persist truena en vez de simplemente no persistir.
const safeStorage = createJSONStorage(() => ({
  getItem: (name) => {
    try { return window.localStorage.getItem(name) } catch { return null }
  },
  setItem: (name, value) => {
    try { window.localStorage.setItem(name, value) } catch { /* no-op */ }
  },
  removeItem: (name) => {
    try { window.localStorage.removeItem(name) } catch { /* no-op */ }
  },
}))

export const useMeseroStore = create(
  persist(
    (set) => ({
      currentMeseroId: MESEROS[0].id,
      soloMisMesas: false,
      // adminUnlocked: el mesero admin confirmó su PIN para entrar a /admin. NO se
      // persiste a propósito — un refresh de la app vuelve a pedir el PIN. Se limpia
      // al cambiar de mesero (ver setMesero).
      adminUnlocked: false,
      // sessionUnlocked: el mesero confirmó su PIN al abrir la app en esta sesión. NO se
      // persiste (ver partialize) → cada carga/refresh arranca en false y MeseroGate pide
      // el PIN de nuevo, aunque la identidad sí se recuerde. setMesero lo baja a false para
      // que un cambio programático (p. ej. el fallback de usePosData a meseros[0]) no salte
      // el gate; solo un PIN correcto (MeseroGate/MeseroSwitcher) lo vuelve a subir.
      sessionUnlocked: false,
      setMesero: (id) => set({ currentMeseroId: id, adminUnlocked: false, sessionUnlocked: false }),
      setAdminUnlocked: (v) => set({ adminUnlocked: v }),
      setSessionUnlocked: (v) => set({ sessionUnlocked: v }),
      toggleSoloMisMesas: () => set((s) => ({ soloMisMesas: !s.soloMisMesas })),
    }),
    {
      name: 'pos-balbuena-mesero',
      storage: safeStorage,
      // Solo se persiste la identidad del mesero (y su filtro de mesas). Antes NADA
      // se persistía, así que un refresh reseteaba el mesero al primero de la lista.
      // adminUnlocked queda fuera a propósito: el PIN se vuelve a pedir cada sesión.
      partialize: (s) => ({ currentMeseroId: s.currentMeseroId, soloMisMesas: s.soloMisMesas }),
    },
  ),
)

// Catálogo de mesas y meseros. En modo mock arranca con los datos estáticos (así los
// tests y el modo demo funcionan sin cargar nada); en modo backend `usePosData` lo
// rellena desde Supabase y pisa cualquier valor persistido. Los componentes leen
// siempre de aquí, sin importar el modo.
//
// Persistido (mesas/meseros): en modo mock, crear/borrar una mesa desde el mapa del
// piso solo vive en este store — sin persistir, un refresh de página (o un HMR de
// Vite) lo regresaba a las 15 mesas originales del mock, borrando el cambio.
export const usePosStore = create(
  persist(
    (set) => ({
      mesas: IS_MOCK ? MESAS : [],
      meseros: IS_MOCK ? MESEROS : [],
      // Menú: en mock arranca del catálogo estático; en backend lo rellena usePosData
      // desde Supabase (tabla compartida `platillos` + pos_ingredientes/pos_modificadores).
      platillos: IS_MOCK ? MOCK_PLATILLOS : [],
      ingredientes: IS_MOCK ? MOCK_INGREDIENTES : [],
      modificadores: IS_MOCK ? MOCK_MODIFICADORES : [],
      extras: IS_MOCK ? MOCK_EXTRAS : [],
      categoriasOrden: IS_MOCK ? MOCK_CATEGORIAS_ORDEN : [], // orden de las categorías (nombre -> orden)
      restauranteId: null, // id de la fila `restaurantes` de tali que ancla al POS (solo modo backend)
      setMesas: (mesas) => set({ mesas }),
      setMeseros: (meseros) => set({ meseros }),
      setPlatillos: (platillos) => set({ platillos }),
      setIngredientes: (ingredientes) => set({ ingredientes }),
      setModificadores: (modificadores) => set({ modificadores }),
      setExtras: (extras) => set({ extras }),
      setCategoriasOrden: (categoriasOrden) => set({ categoriasOrden }),
      setRestauranteId: (restauranteId) => set({ restauranteId }),
    }),
    {
      name: 'pos-balbuena-catalogo',
      storage: safeStorage,
      version: 4,
      // v0 (antes del admin/menú) persistía meseros sin esAdmin y sin catálogo de menú.
      // v2 corrigió el catálogo contra el menú real de Av. Líbano. v3 agregó las
      // allowlists por platillo. v4 agrega el orden de categorías y `orden` en platillos.
      // En cada salto se re-siembran meseros y menú del mock, conservando las mesas que el
      // usuario creó. En backend no importa: usePosData pisa todo al cargar.
      migrate: (persisted, version) => {
        if (version < 4 && IS_MOCK) {
          return {
            ...persisted,
            meseros: MESEROS,
            platillos: MOCK_PLATILLOS,
            ingredientes: MOCK_INGREDIENTES,
            modificadores: MOCK_MODIFICADORES,
            extras: MOCK_EXTRAS,
            categoriasOrden: MOCK_CATEGORIAS_ORDEN,
          }
        }
        return persisted
      },
      partialize: (s) => ({
        mesas: s.mesas, meseros: s.meseros,
        platillos: s.platillos, ingredientes: s.ingredientes,
        modificadores: s.modificadores, extras: s.extras, categoriasOrden: s.categoriasOrden,
      }),
    },
  ),
)

// posiciones: mesaId -> { x, y } en fracción (0–1) del área de piso disponible,
// para que el mesero pueda acomodar el mapa como el salón real y no como una
// lista. Persistido para que sobreviva recargas y se comparta entre dispositivos
// igual que las órdenes.
export const useMesaLayoutStore = create(
  persist(
    (set) => ({
      posiciones: {},
      setPosicion: (mesaId, x, y) =>
        set((s) => ({ posiciones: { ...s.posiciones, [mesaId]: { x, y } } })),
    }),
    { name: 'pos-balbuena-mesa-layout', storage: safeStorage },
  ),
)

// Mesas recién pagadas (el pago ocurre en tali; aquí solo se refleja). A propósito NO
// se persiste: es una señal efímera de sesión — la tarjeta muestra "Pagada" hasta que
// el mesero recarga la página o abre una cuenta nueva (agrega un producto). usePosData
// la enciende al detectar el pago por Realtime y la apaga cuando la mesa vuelve a tener
// cuenta activa. En modo mock no se usa (no hay flujo de pago).
export const useMesaPagadaStore = create((set) => ({
  pagadas: {}, // mesaId -> { at, total }
  marcarPagada: (mesaId, info) =>
    set((s) => (mesaId in s.pagadas ? s : { pagadas: { ...s.pagadas, [mesaId]: info } })),
  limpiarPagada: (mesaId) =>
    set((s) => {
      if (!(mesaId in s.pagadas)) return s
      const { [mesaId]: _omit, ...rest } = s.pagadas
      return { pagadas: rest }
    }),
}))

const EMPTY_ITEMS = []

// drafts: mesaId -> item[] (orden en construcción, aún no enviada a cocina)
// cuentas: mesaId -> { items: item[], createdAt } (ya enviado a cocina)
//
// Persistido en localStorage: en esta fase (sin Supabase real) el mesero y la cocina
// corren en pestañas/dispositivos distintos, así que sin esto no habría forma de que
// un pedido enviado desde la mesa le llegara a la pantalla de cocina.
export const useOrderStore = create(
  persist(
    (set, get) => ({
      drafts: {},
      cuentas: {},

      getDraft: (mesaId) => get().drafts[mesaId] ?? EMPTY_ITEMS,
      getCuenta: (mesaId) => get().cuentas[mesaId] ?? null,

      // Reemplaza el mapa completo de cuentas. Lo usa usePosData al cargar/refrescar
      // desde Supabase (en modo backend la fuente de verdad es la base, no localStorage).
      setCuentas: (cuentas) => set({ cuentas }),

      addDraftItem: (mesaId, item) =>
        set((s) => ({ drafts: { ...s.drafts, [mesaId]: [...(s.drafts[mesaId] ?? []), item] } })),

      updateDraftItem: (mesaId, itemId, patch) =>
        set((s) => ({
          drafts: {
            ...s.drafts,
            [mesaId]: (s.drafts[mesaId] ?? []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
          },
        })),

      removeDraftItem: (mesaId, itemId) =>
        set((s) => ({
          drafts: { ...s.drafts, [mesaId]: (s.drafts[mesaId] ?? []).filter((it) => it.id !== itemId) },
        })),

      clearDraft: (mesaId) =>
        set((s) => ({ drafts: { ...s.drafts, [mesaId]: [] } })),

      // Espejo de updateDraftItem/removeDraftItem pero sobre un renglón ya enviado
      // (cuentas[mesaId].items), para que el total del ticket refleje la edición.
      actualizarCantidadItemCuenta: (mesaId, itemId, cantidad) =>
        set((s) => {
          const cuenta = s.cuentas[mesaId]
          if (!cuenta) return s
          return {
            cuentas: {
              ...s.cuentas,
              [mesaId]: { ...cuenta, items: cuenta.items.map((it) => (it.id === itemId ? { ...it, cantidad } : it)) },
            },
          }
        }),

      quitarItemCuenta: (mesaId, itemId) =>
        set((s) => {
          const cuenta = s.cuentas[mesaId]
          if (!cuenta) return s
          return {
            cuentas: { ...s.cuentas, [mesaId]: { ...cuenta, items: cuenta.items.filter((it) => it.id !== itemId) } },
          }
        }),

      enviarOrden: (mesaId) =>
        set((s) => {
          const items = s.drafts[mesaId] ?? []
          if (items.length === 0) return s
          const existing = s.cuentas[mesaId]
          return {
            drafts: { ...s.drafts, [mesaId]: [] },
            cuentas: {
              ...s.cuentas,
              [mesaId]: {
                items: [...(existing?.items ?? []), ...items],
                createdAt: existing?.createdAt ?? new Date().toISOString(),
              },
            },
          }
        }),

      cerrarCuenta: (mesaId) =>
        set((s) => {
          const { [mesaId]: _omit, ...rest } = s.cuentas
          return { cuentas: rest }
        }),
    }),
    { name: 'pos-balbuena-orders', storage: safeStorage },
  ),
)

// Columna de tiempo propia de cada etapa (además de estadoActualizadoAt): así el
// cronómetro de la tarjeta se puede reiniciar por columna, y el tiempo en "listo"
// queda congelado en el pedido al llegar a "entregado" (útil para reportes después).
const COLUMNA_TIEMPO = { preparando: 'preparandoAt', listo: 'listoAt', entregado: 'entregadoAt' }

// pedidos: uno por cada "enviar a cocina" (un ticket completo), no por platillo suelto —
// así la cocina agrupa por pedido realizado tal como se pidió.
export const usePedidosStore = create(
  persist(
    (set) => ({
      pedidos: [], // { id, mesaId, mesaNumero, meseroNombre, items, enviadoAt, estado, estadoActualizadoAt, preparandoAt, listoAt, entregadoAt }

      // Reemplaza la lista completa. Lo usa usePosData al cargar/refrescar desde Supabase.
      setPedidos: (pedidos) => set({ pedidos }),

      agregarPedido: (pedido) => set((s) => ({ pedidos: [...s.pedidos, pedido] })),

      avanzarEstado: (pedidoId, estado) =>
        set((s) => {
          const ahora = new Date().toISOString()
          const columna = COLUMNA_TIEMPO[estado]
          return {
            pedidos: s.pedidos.map((p) =>
              p.id === pedidoId
                ? { ...p, estado, estadoActualizadoAt: ahora, ...(columna ? { [columna]: ahora } : {}) }
                : p,
            ),
          }
        }),

      eliminarPedidosDeMesa: (mesaId) =>
        set((s) => ({ pedidos: s.pedidos.filter((p) => p.mesaId !== mesaId) })),

      // Solo mutan un pedido que sigue 'pendiente' (Nuevo) — mismo guard que el RPC
      // pos_editar_item_pedido/pos_eliminar_item_pedido del modo backend. Fuera de esa
      // condición son no-op, para que el modo mock se comporte igual que el real aunque
      // la UI ya debería evitar llamar esto en ese caso.
      actualizarCantidadItemPedido: (pedidoId, itemId, cantidad) =>
        set((s) => ({
          pedidos: s.pedidos.map((p) =>
            p.id === pedidoId && p.estado === 'pendiente'
              ? { ...p, items: p.items.map((it) => (it.id === itemId ? { ...it, cantidad } : it)) }
              : p,
          ),
        })),

      quitarItemPedido: (pedidoId, itemId) =>
        set((s) => ({
          pedidos: s.pedidos
            .map((p) => (p.id === pedidoId && p.estado === 'pendiente' ? { ...p, items: p.items.filter((it) => it.id !== itemId) } : p))
            .filter((p) => p.id !== pedidoId || p.items.length > 0),
        })),
    }),
    { name: 'pos-balbuena-pedidos', storage: safeStorage },
  ),
)

// Solo en modo mock el "backend" es localStorage compartido entre pestañas: cuando otra
// pestaña escribe, esta rehidrata para reflejar el cambio (mesero -> cocina). En modo
// backend la sincronización la hace Supabase Realtime (usePosData), así que rehidratar
// desde localStorage aquí solo pisaría el estado fresco con datos viejos.
if (IS_MOCK && typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'pos-balbuena-orders') useOrderStore.persist.rehydrate()
    if (e.key === 'pos-balbuena-pedidos') usePedidosStore.persist.rehydrate()
    if (e.key === 'pos-balbuena-catalogo') usePosStore.persist.rehydrate()
  })
}
