import { useEffect } from 'react'
import { sb } from '../lib/supabase'
import { IS_MOCK, RESTAURANTE_NOMBRE } from '../lib/config'
import {
  usePosStore,
  useOrderStore,
  usePedidosStore,
  useMeseroStore,
} from '../store/appStore'

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
    permiteMitades: p.permite_mitades ?? false,
    permiteNota: p.permite_nota ?? false,
    activo: p.activo,
  }))
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

export async function cargarTodo(rid) {
  const [mesasRes, meserosRes, cuentasRes, pedidosRes, platillosRes, ingredientesRes, modificadoresRes, extrasRes] = await Promise.all([
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
  ])

  const { setMesas, setMeseros, setPlatillos, setIngredientes, setModificadores, setExtras } = usePosStore.getState()
  setMesas((mesasRes.data ?? []).slice().sort(porNumero))

  const meseros = mapMeseros(meserosRes.data)
  setMeseros(meseros)

  setPlatillos(mapPlatillos(platillosRes.data))
  setIngredientes(mapIngredientes(ingredientesRes.data))
  setModificadores(mapModificadores(modificadoresRes.data))
  setExtras(mapExtras(extrasRes.data))

  // Si el mesero seleccionado ya no existe (ids reales ≠ ids mock), cae al primero.
  const meseroState = useMeseroStore.getState()
  if (meseros.length && !meseros.some((m) => m.id === meseroState.currentMeseroId)) {
    meseroState.setMesero(meseros[0].id)
  }

  useOrderStore.getState().setCuentas(mapCuentas(cuentasRes.data))
  usePedidosStore.getState().setPedidos(mapPedidos(pedidosRes.data))
}

// Carga inicial + suscripción en tiempo real. Se monta una sola vez en la raíz de la app
// (App.jsx) para que la vista de mesero y la de cocina compartan estado.
// En modo mock no hace nada: los stores ya arrancan con los datos estáticos.
export function usePosData() {
  useEffect(() => {
    if (IS_MOCK) return

    let vivo = true
    let channel = null
    let recargarTimer = null

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
        .subscribe()
    }

    init()

    return () => {
      vivo = false
      clearTimeout(recargarTimer)
      if (channel) sb.removeChannel(channel)
    }
  }, [])
}
