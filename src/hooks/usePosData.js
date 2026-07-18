import { useEffect } from 'react'
import { sb } from '../lib/supabase'
import { IS_MOCK, RESTAURANTE_NOMBRE } from '../lib/config'
import {
  usePosStore,
  useOrderStore,
  usePedidosStore,
  useMeseroStore,
  useMesaPagadaStore,
} from '../store/appStore'
import { sumaCuenta } from './useOrderDraft'

// Ordena números como texto ('2' antes que '10') para el mapa del piso.
const porNumero = (a, b) => Number(a.numero) - Number(b.numero)

// Cuentas de tali → mapa mesaId -> { cuentaId, items[], createdAt }.
// cuenta_items es PLANO (nombre, precio_unitario, cantidad): así lo modela tali y
// así lo consume el POS para el total y la comanda.
function mapCuentas(cuentas) {
  const map = {}
  for (const c of cuentas ?? []) {
    const items = (c.cuenta_items ?? [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    map[c.mesa_id] = { cuentaId: c.id, items, createdAt: c.created_at }
  }
  return map
}

// meseros de Supabase → forma de la app (es_admin snake_case → esAdmin camelCase,
// como lo usa el mock y el gate de admin). El resto de columnas pasa igual.
function mapMeseros(rows) {
  return (rows ?? []).map((m) => ({ ...m, esAdmin: m.es_admin ?? false }))
}

// platillos (tabla compartida con tali) → forma que consume el flujo de orden.
// base cae a descripcion por si un platillo se creó desde tali (sin columnas POS).
function mapPlatillos(rows) {
  return (rows ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoria,
    base: p.base ?? p.descripcion ?? '',
    tiers: p.tiers ?? [],
    tortillas: p.tortillas ?? undefined,
    // Allowlists por platillo de qué modificadores/extras aplican (null = heredado).
    modificadores: p.modificadores ?? null,
    extras: p.extras ?? null,
    permiteMitades: p.permite_mitades ?? false,
    permiteNota: p.permite_nota ?? false,
    orden: p.orden ?? 0,
    activo: p.activo,
  }))
}

function mapCategorias(rows) {
  return (rows ?? []).map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden ?? 0 }))
}

function mapIngredientes(rows) {
  return (rows ?? []).map((i) => ({ id: i.id, nombre: i.nombre, extra: Number(i.extra ?? 0), activo: i.activo, orden: i.orden ?? 0 }))
}

function mapModificadores(rows) {
  return (rows ?? []).map((m) => ({ id: m.id, nombre: m.nombre, activo: m.activo, orden: m.orden ?? 0 }))
}

function mapExtras(rows) {
  return (rows ?? []).map((e) => ({ id: e.id, nombre: e.nombre, precio: Number(e.precio ?? 0), activo: e.activo, orden: e.orden ?? 0 }))
}

function mapPedidos(pedidos) {
  return (pedidos ?? []).map((p) => ({
    id: p.id,
    mesaId: p.mesa_id,
    mesaNumero: p.mesa_numero,
    meseroNombre: p.mesero_nombre,
    items: p.items ?? [],
    enviadoAt: p.enviado_at,
    estado: p.estado,
    estadoActualizadoAt: p.estado_actualizado_at,
    preparandoAt: p.preparando_at,
    listoAt: p.listo_at,
    entregadoAt: p.entregado_at,
  }))
}

// Baseline de cuentas ya pagadas al arrancar la sesión: las que ya estaban pagadas en el
// primer cargarTodo son "viejas" y NO se anuncian como Pagada (por eso el badge desaparece
// tras recargar). Solo los pagos que ocurren DURANTE la sesión se marcan. Es de módulo (no
// de efecto) para sobrevivir remontajes; se resetea al recargar la página, que es justo la
// semántica deseada ("hasta que recargue"). null = aún no se ha tomado el baseline.
let pagadasVistas = null

// Detecta mesas recién pagadas comparando contra el baseline. `activas` es el mapa de
// cuentas activas ya calculado, para no marcar Pagada una mesa que ya abrió otra cuenta.
function detectarPagadas(rows, activas) {
  const paid = rows ?? []
  const { marcarPagada, limpiarPagada, pagadas } = useMesaPagadaStore.getState()
  if (pagadasVistas === null) {
    pagadasVistas = new Set(paid.map((c) => c.id)) // primer load: todo lo pagado es viejo
  } else {
    for (const c of paid) {
      if (pagadasVistas.has(c.id)) continue
      pagadasVistas.add(c.id)
      if (activas[c.mesa_id]) continue // ya reabrió cuenta → no anunciar
      const total = (c.cuenta_items ?? []).reduce((s, it) => s + Number(it.precio_unitario) * Number(it.cantidad), 0)
      marcarPagada(c.mesa_id, { at: c.closed_at, total })
    }
  }
  // Apaga el badge de mesas que volvieron a tener cuenta activa (abrieron otra orden).
  for (const mesaId of Object.keys(pagadas)) {
    if (activas[mesaId]) limpiarPagada(mesaId)
  }
}

// Consulta las dos formas de una cuenta (activas + pagadas recientes) y actualiza estado.
// Es la versión LIGERA de cargarTodo (2 queries, sin menú/meseros): la usan el broadcast
// de pago de tali y el sondeo periódico, porque un cobro solo cambia `cuentas`.
async function refrescarCuentas(rid) {
  const desdePagos = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const [cuentasRes, pagadasRes] = await Promise.all([
    sb.from('cuentas').select('*, cuenta_items(*)').eq('restaurante_id', rid).eq('activa', true),
    sb.from('cuentas').select('id, mesa_id, closed_at, cuenta_items(precio_unitario, cantidad)')
      .eq('restaurante_id', rid).eq('estado', 'pagada').gte('closed_at', desdePagos),
  ])
  if (cuentasRes.error) return
  const activas = mapCuentas(cuentasRes.data)
  useOrderStore.getState().setCuentas(activas)
  detectarPagadas(pagadasRes.data, activas)
}

export async function cargarTodo(rid) {
  // Ventana de pagos recientes que miramos para detectar "Pagada" (12 h cubre un turno).
  const desdePagos = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const [mesasRes, meserosRes, cuentasRes, pedidosRes, platillosRes, ingredientesRes, modificadoresRes, extrasRes, categoriasRes, pagadasRes] = await Promise.all([
    sb.from('mesas').select('*').eq('restaurante_id', rid).eq('activo', true),
    sb.from('meseros').select('*').eq('restaurante_id', rid).eq('activo', true).order('nombre'),
    sb.from('cuentas').select('*, cuenta_items(*)').eq('restaurante_id', rid).eq('activa', true),
    sb.from('pedidos').select('*').eq('restaurante_id', rid),
    // Menú: se cargan TODOS (incluidos inactivos) para que el admin los vea; el flujo
    // de orden filtra activo en useMenu.
    sb.from('platillos').select('*').eq('restaurante_id', rid).order('categoria', { nullsFirst: false }).order('nombre'),
    sb.from('pos_ingredientes').select('*').eq('restaurante_id', rid).order('orden').order('nombre'),
    sb.from('pos_modificadores').select('*').eq('restaurante_id', rid).order('orden').order('nombre'),
    sb.from('pos_extras').select('*').eq('restaurante_id', rid).order('orden').order('nombre'),
    sb.from('pos_categorias').select('*').eq('restaurante_id', rid).order('orden'),
    // Cuentas pagadas recientemente (pago hecho en tali: estado='pagada', activa=false).
    // Se usan solo para encender el badge "Pagada" del lado del mesero (ver detectarPagadas).
    sb.from('cuentas').select('id, mesa_id, closed_at, cuenta_items(precio_unitario, cantidad)')
      .eq('restaurante_id', rid).eq('estado', 'pagada').gte('closed_at', desdePagos),
  ])

  const { setMesas, setMeseros, setPlatillos, setIngredientes, setModificadores, setExtras, setCategoriasOrden } = usePosStore.getState()
  setMesas((mesasRes.data ?? []).slice().sort(porNumero))

  const meseros = mapMeseros(meserosRes.data)
  setMeseros(meseros)

  setPlatillos(mapPlatillos(platillosRes.data))
  setIngredientes(mapIngredientes(ingredientesRes.data))
  setModificadores(mapModificadores(modificadoresRes.data))
  setExtras(mapExtras(extrasRes.data))
  setCategoriasOrden(mapCategorias(categoriasRes.data))

  // Si el mesero seleccionado ya no existe (ids reales ≠ ids mock), cae al primero.
  const meseroState = useMeseroStore.getState()
  if (meseros.length && !meseros.some((m) => m.id === meseroState.currentMeseroId)) {
    meseroState.setMesero(meseros[0].id)
  }

  const activas = mapCuentas(cuentasRes.data)
  useOrderStore.getState().setCuentas(activas)
  usePedidosStore.getState().setPedidos(mapPedidos(pedidosRes.data))
  detectarPagadas(pagadasRes.data, activas)
}

// Carga inicial + suscripción en tiempo real. Se monta una sola vez en la raíz de la app
// (App.jsx) para que la vista de mesero y la de cocina compartan estado.
// En modo mock no hace nada: los stores ya arrancan con los datos estáticos.
export function usePosData() {
  useEffect(() => {
    if (IS_MOCK) return

    let vivo = true
    let channel = null
    let panelSync = null
    let recargarTimer = null
    let pollId = null

    async function init() {
      const { data: rest, error } = await sb
        .from('restaurantes').select('id').eq('nombre', RESTAURANTE_NOMBRE).maybeSingle()
      if (error) { console.error('[pos-data] no se pudo leer el restaurante:', error); return }
      const rid = rest?.id
      if (!rid) {
        console.error(`[pos-data] no existe el restaurante "${RESTAURANTE_NOMBRE}". Corre supabase/seed.sql.`)
        return
      }
      if (!vivo) return
      usePosStore.getState().setRestauranteId(rid)

      await cargarTodo(rid).catch((e) => console.error('[pos-data] carga inicial falló:', e))

      // Cualquier cambio en las tablas compartidas dispara una recarga completa (misma
      // estrategia que tali). Filtramos por restaurante donde la tabla lo permite, para
      // no recargar por actividad de otros restaurantes del proyecto compartido.
      // Un solo "enviar a cocina" produce una ráfaga de eventos (cuentas + una fila de
      // cuenta_items por platillo + pedidos); sin debounce cada uno lanzaría un cargarTodo
      // que corre en paralelo con los demás y se pisan, provocando el parpadeo del ticket
      // (los renglones desaparecen y reaparecen). El debounce colapsa la ráfaga en una
      // sola recarga ~200 ms después del último evento, ya con todo comiteado.
      const recargar = () => {
        if (!vivo) return
        clearTimeout(recargarTimer)
        recargarTimer = setTimeout(() => { if (vivo) cargarTodo(rid).catch(() => {}) }, 200)
      }
      channel = sb
        .channel('pos-balbuena-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas', filter: `restaurante_id=eq.${rid}` }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'meseros', filter: `restaurante_id=eq.${rid}` }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas', filter: `restaurante_id=eq.${rid}` }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cuenta_items' }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `restaurante_id=eq.${rid}` }, recargar)
        // Menú: un cambio desde el admin (o desde tali) se refleja en todas las tablets.
        .on('postgres_changes', { event: '*', schema: 'public', table: 'platillos', filter: `restaurante_id=eq.${rid}` }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_ingredientes', filter: `restaurante_id=eq.${rid}` }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_modificadores', filter: `restaurante_id=eq.${rid}` }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_extras', filter: `restaurante_id=eq.${rid}` }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_categorias', filter: `restaurante_id=eq.${rid}` }, recargar)
        .subscribe()

      // El pago se hace en tali, NO en el POS. tali no depende de postgres_changes sobre
      // `cuentas` para reflejarlo: al cobrar hace broadcast en el canal 'tali-panel-sync'
      // (event 'cuenta-actualizada'). Nos sumamos a ese mismo canal para enterarnos del
      // pago al instante y refrescar las cuentas — así la mesa pasa a "Pagada" al momento.
      panelSync = sb
        .channel('tali-panel-sync')
        .on('broadcast', { event: 'cuenta-actualizada' }, ({ payload }) => {
          // Al cobrar, tali pone la cuenta activa=false. La RLS de `cuentas` solo deja leer
          // filas activas a la anon key, así que NO podemos releer la cuenta pagada para
          // saber su mesa. Pero en este instante todavía la tenemos en el estado local:
          // mapeamos cuenta_id → mesa aquí mismo y marcamos "Pagada" antes de refrescar.
          if (payload?.estado === 'pagada' && payload?.cuenta_id) {
            const cuentas = useOrderStore.getState().cuentas
            const hit = Object.entries(cuentas).find(([, c]) => c.cuentaId === payload.cuenta_id)
            if (hit) {
              const [mesaId, c] = hit
              useMesaPagadaStore.getState().marcarPagada(mesaId, { at: c.createdAt, total: sumaCuenta(c.items ?? []) })
              // La cuenta ya la cerró tali, pero el pedido del POS (cocina) sigue vivo y, al
              // recargar, haría que la mesa reapareciera como "Pedido enviado". La cerramos
              // del lado POS: pos_cerrar_mesa borra sus pedidos (la cuenta activa=false ya no
              // la toca). Optimista: también lo quitamos local para no esperar el Realtime.
              usePedidosStore.getState().eliminarPedidosDeMesa(mesaId)
              sb.rpc('pos_cerrar_mesa', { p_mesa_id: mesaId }).then(() => {})
            }
          }
          if (vivo) refrescarCuentas(rid).catch(() => {})
        })
        .subscribe()

      // Red de seguridad: si un broadcast se pierde (tablet dormida, reconexión, o el POS
      // abierto después del cobro), un sondeo ligero (solo cuentas) garantiza que el estado
      // de las mesas —incl. "Pagada"— converja igual, aunque `cuentas` no emita Realtime.
      pollId = setInterval(() => { if (vivo) refrescarCuentas(rid).catch(() => {}) }, 15000)
    }

    init()

    return () => {
      vivo = false
      clearTimeout(recargarTimer)
      clearInterval(pollId)
      if (channel) sb.removeChannel(channel)
      if (panelSync) sb.removeChannel(panelSync)
    }
  }, [])
}
