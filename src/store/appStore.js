import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { IS_MOCK } from '../lib/config'
import { MESEROS } from '../lib/mockMeseros'
import { MESAS } from '../lib/mockMesas'

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

export const useMeseroStore = create((set) => ({
  currentMeseroId: MESEROS[0].id,
  soloMisMesas: false,
  setMesero: (id) => set({ currentMeseroId: id }),
  toggleSoloMisMesas: () => set((s) => ({ soloMisMesas: !s.soloMisMesas })),
}))

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
      restauranteId: null, // id de la fila `restaurantes` de tali que ancla al POS (solo modo backend)
      setMesas: (mesas) => set({ mesas }),
      setMeseros: (meseros) => set({ meseros }),
      setRestauranteId: (restauranteId) => set({ restauranteId }),
    }),
    {
      name: 'pos-balbuena-catalogo',
      storage: safeStorage,
      partialize: (s) => ({ mesas: s.mesas, meseros: s.meseros }),
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
