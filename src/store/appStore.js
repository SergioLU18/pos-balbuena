import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { uid } from '../lib/utils'

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
      // null hasta que usePosData carga los meseros: ahí cae al primero si el guardado
      // ya no existe.
      currentMeseroId: null,
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
      // lastAdminPath: última pestaña de /admin que se vio (p. ej. "/admin/mesas"). Se
      // persiste para que, al volver a entrar a Ajustes tras un bloqueo/refresh, el PIN
      // regrese a esa pestaña en vez de caer siempre en "/admin/menu" (ver AdminApp/AdminEntry).
      lastAdminPath: '/admin/menu',
      setMesero: (id) => set({ currentMeseroId: id, adminUnlocked: false, sessionUnlocked: false }),
      setAdminUnlocked: (v) => set({ adminUnlocked: v }),
      setSessionUnlocked: (v) => set({ sessionUnlocked: v }),
      setLastAdminPath: (path) => set({ lastAdminPath: path }),
    }),
    {
      name: 'pos-balbuena-mesero',
      storage: safeStorage,
      // Solo se persiste la identidad del mesero. Antes NADA se persistía, así que un
      // refresh reseteaba el mesero al primero de la lista.
      // adminUnlocked queda fuera a propósito: el PIN se vuelve a pedir cada sesión.
      partialize: (s) => ({
        currentMeseroId: s.currentMeseroId,
        lastAdminPath: s.lastAdminPath,
      }),
    },
  ),
)

// Catálogo de mesas, meseros y menú. `usePosData` lo rellena desde Supabase y pisa
// cualquier valor persistido; los componentes leen siempre de aquí. Lo persistido solo
// sirve para pintar algo mientras llega la primera carga.
export const usePosStore = create(
  persist(
    (set) => ({
      mesas: [],
      meseros: [],
      // Menú: tabla compartida `platillos` + pos_ingredientes/pos_modificadores/pos_extras.
      // Ingredientes, modificadores y extras llegan como objetos con id/activo/orden (así
      // los edita el admin); el flujo de orden los recibe aplanados por useMenu.
      platillos: [],
      ingredientes: [],
      modificadores: [],
      extras: [],
      categoriasOrden: [], // orden de las categorías (nombre -> orden)
      restauranteId: null, // id de la fila `restaurantes` de tali que ancla al POS
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
      version: 6,
      // Los saltos de versión re-sembraban el catálogo del antiguo modo demo. Hoy
      // usePosData pisa todo al cargar, así que lo persistido de cualquier versión sirve
      // tal cual; sin `migrate`, persist lo descartaría y avisaría en consola.
      migrate: (persisted) => persisted,
      partialize: (s) => ({
        mesas: s.mesas, meseros: s.meseros,
        platillos: s.platillos, ingredientes: s.ingredientes,
        modificadores: s.modificadores, extras: s.extras, categoriasOrden: s.categoriasOrden,
      }),
    },
  ),
)

// Cuánto dura el badge verde "Pagada" en el piso antes de volver sola a "libre": el mesero
// solo necesita el aviso un momento para confirmar que se cobró, no todo el turno.
const PAGADA_MS = 3 * 60 * 1000

// Mesas recién pagadas — ya sea porque tali cerró el pago o porque el mesero cerró la
// mesa a mano (efectivo/tarjeta, ver cerrarMesa en useOrderDraft). A propósito NO se
// persiste: es una señal efímera de sesión. La tarjeta muestra "Pagada" hasta que pasan
// PAGADA_MS (se agenda sola desde marcarPagada) o hasta que la mesa vuelve a tener cuenta
// activa o un draft (el mesero agregó un platillo nuevo, ver limpiarPagada en useMesas).
export const useMesaPagadaStore = create((set, get) => ({
  pagadas: {}, // mesaId -> { at, total }
  marcarPagada: (mesaId, info) => {
    if (mesaId in get().pagadas) return // ya estaba marcada: no reinicia su propio timeout
    set((s) => ({ pagadas: { ...s.pagadas, [mesaId]: info } }))
    setTimeout(() => get().limpiarPagada(mesaId), PAGADA_MS)
  },
  limpiarPagada: (mesaId) =>
    set((s) => {
      if (!(mesaId in s.pagadas)) return s
      const { [mesaId]: _omit, ...rest } = s.pagadas
      return { pagadas: rest }
    }),
}))

// Para llevar: padrón de clientes del restaurante y órdenes de mostrador/teléfono.
//
// Una orden para llevar es la contraparte de una cuenta de mesa cuando NO hay mesa: se
// identifica por el cliente (que se busca por teléfono) y por un folio corto. Vive en su
// propio store —y en sus propias tablas— porque `cuentas` es de tali y todo su flujo de
// dividir y pagar está anclado a una mesa; una orden de mostrador se cobra en caja.
//
// El total de una orden ABIERTA no se guarda: se deriva de sus pedidos (usePedidosStore),
// que es donde ya viven los renglones con su precio. Solo al cerrarla se congelan `total`
// e `items` en la fila, y eso es lo que sostiene el historial de compras del cliente
// aunque después se limpien los pedidos de cocina.
//
// Persistido igual que el resto; usePosData lo pisa al cargar.
export const useLlevarStore = create(
  persist(
    (set) => ({
      clientes: [], // { id, telefono (solo dígitos), nombre, direccion, nota }
      // { id, folio, clienteId, clienteNombre, clienteTelefono, direccion, meseroId,
      //   meseroNombre, estado: 'abierta'|'entregada'|'cancelada', metodoPago,
      //   total, items, createdAt, closedAt }
      ordenes: [],

      setClientes: (clientes) => set({ clientes }),
      setOrdenes: (ordenes) => set({ ordenes }),

      // Alta o edición por id. El teléfono ya viene normalizado por quien llama
      // (useLlevar), que es también quien evita dar de alta dos veces el mismo número.
      guardarClienteLocal: (cliente) =>
        set((s) => ({
          clientes: s.clientes.some((c) => c.id === cliente.id)
            ? s.clientes.map((c) => (c.id === cliente.id ? { ...c, ...cliente } : c))
            : [...s.clientes, cliente],
        })),

      agregarOrdenLocal: (orden) => set((s) => ({ ordenes: [...s.ordenes, orden] })),

      // Una orden descartada (vacía) no se cierra: se borra, así que tampoco queda aquí.
      quitarOrdenLocal: (ordenId) => set((s) => ({ ordenes: s.ordenes.filter((o) => o.id !== ordenId) })),
    }),
    { name: 'pos-balbuena-llevar', storage: safeStorage },
  ),
)

// A qué impresora manda esta tablet (Ajustes → Impresora). Se guarda por tablet y no en
// Supabase: es un dato de la red local del restaurante, y así cada tablet se puede
// probar contra la impresora sin afectar a las demás.
export const useImpresoraStore = create(
  persist(
    (set) => ({
      host: '',
      puerto: 9100,
      // Imprimir la comanda en cuanto una orden llega a cocina (ver imprimirComanda).
      comandaAlEnviar: true,
      setImpresora: ({ host, puerto }) => set({ host: host.trim(), puerto: Number(puerto) || 9100 }),
      setComandaAlEnviar: (comandaAlEnviar) => set({ comandaAlEnviar }),
    }),
    { name: 'pos-balbuena-impresora', storage: safeStorage },
  ),
)

// Avisos del turno: la contraparte VISIBLE de los sonidos. El tono dice "algo pasó",
// pero no qué ni en qué mesa, y si el mesero traía la tablet lejos puede que ni lo haya
// oído. Aquí queda el registro para consultarlo cuando pueda. NO se persiste: es
// información del turno en curso, no historial — al recargar se empieza limpio.
const MAX_AVISOS = 30

export const useAvisosStore = create((set) => ({
  // `ruta` es a dónde lleva tocar el aviso. Existe porque no todo aviso es de una mesa:
  // los de una orden PARA LLEVAR apuntan a la orden del cliente, que no tiene mesaId.
  avisos: [], // { id, tipo: 'listo'|'error', titulo, detalle, mesaId, ruta, at, leido }
  agregarAviso: (aviso) =>
    set((s) => ({
      avisos: [
        { ...aviso, id: uid('aviso'), at: new Date().toISOString(), leido: false },
        ...s.avisos,
      ].slice(0, MAX_AVISOS),
    })),
  marcarTodosLeidos: () => set((s) => ({ avisos: s.avisos.map((a) => ({ ...a, leido: true })) })),
  limpiarAvisos: () => set({ avisos: [] }),
}))

const EMPTY_ITEMS = []

// drafts: mesaId -> item[] (orden en construcción, aún no enviada a cocina)
// cuentas: mesaId -> { items: item[], createdAt } (ya enviado a cocina)
//
// Persistido en localStorage: los drafts solo existen en esta tablet, así que un refresh
// no debe tirar una orden a medio tomar. Las cuentas las pisa usePosData al cargar.
export const useOrderStore = create(
  persist(
    (set, get) => ({
      drafts: {},
      cuentas: {},

      getDraft: (mesaId) => get().drafts[mesaId] ?? EMPTY_ITEMS,
      getCuenta: (mesaId) => get().cuentas[mesaId] ?? null,

      // Reemplaza el mapa completo de cuentas. Lo usa usePosData al cargar/refrescar
      // desde Supabase (la fuente de verdad es la base, no localStorage).
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

      cerrarCuenta: (mesaId) =>
        set((s) => {
          const { [mesaId]: _omit, ...rest } = s.cuentas
          return { cuentas: rest }
        }),

      // Unir mesas: los drafts de las secundarias pasan a la principal (solo existen en
      // esta tablet). Las cuentas las mueve pos_unir_mesas y llegan por Realtime.
      juntarEnMesa: (deIds, aId) =>
        set((s) => {
          const drafts = { ...s.drafts }
          for (const id of deIds) {
            if (drafts[id]?.length) drafts[aId] = [...(drafts[aId] ?? []), ...drafts[id]]
            delete drafts[id]
          }
          return { drafts }
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
      // meseroId: quién mandó ESTE pedido. Una mesa puede tener varios meseros, así que
      // la mesa ya no basta para saber a quién avisarle que su platillo está listo.
      // meseroNombre se queda al lado, denormalizado, para el ticket de cocina.
      // Un pedido para llevar (tipo: 'llevar') no trae mesa: en su lugar apunta a la orden
      // de mostrador (ordenLlevarId) y carga el nombre del cliente para la comanda.
      pedidos: [], // { id, tipo: 'mesa'|'llevar', mesaId, mesaNumero, ordenLlevarId, clienteNombre, meseroId, meseroNombre, items, enviadoAt, estado, estadoActualizadoAt, preparandoAt, listoAt, entregadoAt }

      // Reemplaza la lista completa. Lo usa usePosData al cargar/refrescar desde Supabase.
      setPedidos: (pedidos) => set({ pedidos }),

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

      // La contraparte para una orden PARA LLEVAR, que no tiene mesa por la cual filtrar:
      // al cerrarla sus comandas salen del tablero, igual que al cerrar una mesa.
      eliminarPedidosDeOrdenLlevar: (ordenId) =>
        set((s) => ({ pedidos: s.pedidos.filter((p) => p.ordenLlevarId !== ordenId) })),

      // Solo mutan un pedido que sigue 'pendiente' (Nuevo) — mismo guard que el RPC
      // pos_editar_item_pedido/pos_eliminar_item_pedido. Fuera de esa condición son no-op,
      // para que la actualización optimista no se adelante a algo que el RPC va a rechazar.
      actualizarCantidadItemPedido: (pedidoId, itemId, cantidad) =>
        set((s) => ({
          pedidos: s.pedidos.map((p) =>
            p.id === pedidoId && p.estado === 'pendiente'
              ? { ...p, items: p.items.map((it) => (it.id === itemId ? { ...it, cantidad } : it)) }
              : p,
          ),
        })),

      // Sin el candado de 'pendiente' de arriba: el empaque de un renglón para llevar se
      // puede cambiar mientras la orden siga abierta, aunque cocina ya lo haya tomado
      // (ver pos_empaque_item_llevar).
      actualizarItemPedido: (pedidoId, itemId, patch) =>
        set((s) => ({
          pedidos: s.pedidos.map((p) =>
            p.id === pedidoId
              ? { ...p, items: p.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
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
