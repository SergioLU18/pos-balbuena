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
  const [mesasRes, meserosRes, cuentasRes, pedidosRes] = await Promise.all([
    sb.from('mesas').select('*').eq('restaurante_id', rid).eq('activo', true),
    sb.from('meseros').select('*').eq('restaurante_id', rid).eq('activo', true).order('nombre'),
    sb.from('cuentas').select('*, cuenta_items(*)').eq('restaurante_id', rid).eq('activa', true),
    sb.from('pedidos').select('*').eq('restaurante_id', rid),
  ])

  const { setMesas, setMeseros } = usePosStore.getState()
  setMesas((mesasRes.data ?? []).slice().sort(porNumero))

  const meseros = meserosRes.data ?? []
  setMeseros(meseros)

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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas', filter: `restaurante_id=eq.${rid}` }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cuenta_items' }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `restaurante_id=eq.${rid}` }, recargar)
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
