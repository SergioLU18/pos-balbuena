import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { MESEROS } from '../lib/mockMeseros'

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

// pedidos: uno por cada "enviar a cocina" (un ticket completo), no por platillo suelto —
// así la cocina agrupa por pedido realizado tal como se pidió.
export const usePedidosStore = create(
  persist(
    (set) => ({
      pedidos: [], // { id, mesaId, mesaNumero, meseroNombre, items, enviadoAt, estado, estadoActualizadoAt }

      agregarPedido: (pedido) => set((s) => ({ pedidos: [...s.pedidos, pedido] })),

      avanzarEstado: (pedidoId, estado) =>
        set((s) => ({
          pedidos: s.pedidos.map((p) =>
            p.id === pedidoId ? { ...p, estado, estadoActualizadoAt: new Date().toISOString() } : p,
          ),
        })),

      eliminarPedidosDeMesa: (mesaId) =>
        set((s) => ({ pedidos: s.pedidos.filter((p) => p.mesaId !== mesaId) })),
    }),
    { name: 'pos-balbuena-pedidos', storage: safeStorage },
  ),
)

// zustand/persist no sincroniza entre pestañas por sí solo: cuando otra pestaña
// escribe en localStorage, esta rehidrata para reflejar el cambio (mesero -> cocina).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'pos-balbuena-orders') useOrderStore.persist.rehydrate()
    if (e.key === 'pos-balbuena-pedidos') usePedidosStore.persist.rehydrate()
  })
}
