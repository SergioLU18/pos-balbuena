import { useEffect } from 'react'
import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import {
  usePosStore,
  useOrderStore,
  usePedidosStore,
  useMeseroStore,
} from '../store/appStore'

// Convierte las filas de Supabase a la forma que ya consumen los componentes.
// cuentas: mesaId -> { cuentaId, items[], createdAt } — items es el objeto JSON tal cual.
function mapCuentas(cuentas) {
  const map = {}
  for (const c of cuentas ?? []) {
    const items = (c.pos_cuenta_items ?? [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((ci) => ci.data)
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
  }))
}

async function cargarTodo() {
  const [mesasRes, meserosRes, cuentasRes, pedidosRes] = await Promise.all([
    sb.from('pos_mesas').select('*').eq('activo', true).order('numero'),
    sb.from('pos_meseros').select('*').eq('activo', true).order('nombre'),
    sb.from('pos_cuentas').select('*, pos_cuenta_items(*)').eq('activa', true),
    sb.from('pos_pedidos').select('*'),
  ])

  const { setMesas, setMeseros } = usePosStore.getState()
  // numero puede venir como '2' y '10'; orden numérico para el mapa del piso.
  const mesas = (mesasRes.data ?? []).slice().sort((a, b) => Number(a.numero) - Number(b.numero))
  setMesas(mesas)

  const meseros = meserosRes.data ?? []
  setMeseros(meseros)

  // Si el mesero seleccionado ya no existe (ids reales de la base ≠ ids mock), cae al primero.
  const meseroState = useMeseroStore.getState()
  if (meseros.length && !meseros.some((m) => m.id === meseroState.currentMeseroId)) {
    meseroState.setMesero(meseros[0].id)
  }

  useOrderStore.getState().setCuentas(mapCuentas(cuentasRes.data))
  usePedidosStore.getState().setPedidos(mapPedidos(pedidosRes.data))
}

// Carga inicial + suscripción en tiempo real. Se monta una sola vez en la raíz de la app
// (ver App.jsx) para que tanto la vista de mesero como la de cocina compartan el estado.
// En modo mock no hace nada: los stores ya arrancan con los datos estáticos.
export function usePosData() {
  useEffect(() => {
    if (IS_MOCK) return

    let vivo = true
    cargarTodo().catch((e) => console.error('[pos-data] carga inicial falló:', e))

    // Cualquier cambio en las tablas compartidas dispara una recarga completa. A la
    // escala de un restaurante (decenas de filas) es simple y suficiente, y es el mismo
    // patrón de "refrescar todo ante un cambio" que usa la app hermana (tali).
    const recargar = () => { if (vivo) cargarTodo().catch(() => {}) }
    const channel = sb
      .channel('pos-balbuena-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_mesas' }, recargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_cuentas' }, recargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_cuenta_items' }, recargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_pedidos' }, recargar)
      .subscribe()

    return () => {
      vivo = false
      sb.removeChannel(channel)
    }
  }, [])
}
