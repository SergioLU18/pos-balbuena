import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { uid } from '../lib/utils'
import { normalizarTelefono } from '../lib/telefono'
import { useLlevarStore, useMeseroStore, usePedidosStore, usePosStore } from '../store/appStore'
import { sumaCuenta } from './useOrderDraft'

/** Renglones de una orden abierta: viven en sus pedidos de cocina (no hay tabla espejo
 *  de renglones, ver el comentario de useLlevarStore). Una orden ya cerrada trae su
 *  propia copia congelada en `items`, que es lo que sostiene el historial. */
export function itemsDeOrden(ordenId, pedidos, orden) {
  if (orden?.estado && orden.estado !== 'abierta') return orden.items ?? []
  return pedidos.filter((p) => p.ordenLlevarId === ordenId).flatMap((p) => p.items ?? [])
}

/** Total de una orden: derivado mientras está abierta, congelado una vez cerrada. */
export function totalDeOrden(orden, pedidos) {
  if (orden?.estado && orden.estado !== 'abierta') return Number(orden.total ?? 0)
  return sumaCuenta(itemsDeOrden(orden?.id, pedidos, orden))
}

/** Padrón de clientes y órdenes para llevar: buscar por teléfono, dar de alta/editar la
 *  ficha, abrir una orden nueva y consultar el historial de compras.
 *
 *  El padrón es POR RESTAURANTE (en backend, todas las consultas van filtradas por
 *  restaurante_id, y el índice único del teléfono también lo es): dos restaurantes del
 *  mismo proyecto no se ven los clientes.
 *
 *  Mismo patrón que useMesaAdmin/useMeseroAdmin: en mock muta el store; en backend
 *  escribe con RPC y deja que usePosData recargue por Realtime. */
export function useLlevar() {
  const clientes = useLlevarStore((s) => s.clientes)
  const ordenes = useLlevarStore((s) => s.ordenes)
  const guardarClienteLocal = useLlevarStore((s) => s.guardarClienteLocal)
  const agregarOrdenLocal = useLlevarStore((s) => s.agregarOrdenLocal)
  const pedidos = usePedidosStore((s) => s.pedidos)
  const restauranteId = usePosStore((s) => s.restauranteId)
  const meseros = usePosStore((s) => s.meseros)
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)

  const ordenesAbiertas = ordenes
    .filter((o) => o.estado === 'abierta')
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  /** Busca al cliente por su teléfono. Devuelve `{ cliente: null }` (sin error) cuando no
   *  existe: no encontrarlo es el caso normal del cliente nuevo, no una falla. */
  async function buscarPorTelefono(telefono) {
    const tel = normalizarTelefono(telefono)
    if (!tel) return { cliente: null, error: null }

    if (IS_MOCK) {
      return { cliente: clientes.find((c) => c.telefono === tel) ?? null, error: null }
    }
    const { data, error } = await sb
      .from('clientes')
      .select('*')
      .eq('restaurante_id', restauranteId)
      .eq('telefono', tel)
      .eq('activo', true)
      .maybeSingle()
    if (error) {
      console.error('[llevar] buscarPorTelefono falló:', error)
      return { cliente: null, error: error.message }
    }
    return { cliente: data ? mapCliente(data) : null, error: null }
  }

  /** Alta o edición de la ficha. En backend es un upsert por (restaurante, teléfono):
   *  dos meseros pueden estar dando de alta al mismo número desde dos tablets. */
  async function guardarCliente({ id, telefono, nombre, direccion, nota }) {
    const tel = normalizarTelefono(telefono)

    if (IS_MOCK) {
      // El teléfono identifica al cliente, así que reeditar una ficha existente por
      // número no debe crear una segunda: se reusa el id que ya tenía.
      const existente = clientes.find((c) => c.id === id) ?? clientes.find((c) => c.telefono === tel)
      const cliente = {
        id: existente?.id ?? uid('cliente'),
        telefono: tel,
        nombre: nombre?.trim(),
        direccion: direccion?.trim() || null,
        nota: nota?.trim() || null,
      }
      guardarClienteLocal(cliente)
      return { cliente, error: null }
    }

    const { data, error } = await sb.rpc('pos_guardar_cliente', {
      p_restaurante_id: restauranteId,
      p_telefono: tel,
      p_nombre: nombre,
      p_direccion: direccion ?? null,
      p_nota: nota ?? null,
    })
    if (error) {
      console.error('[llevar] guardarCliente falló:', error)
      return { cliente: null, error: error.message }
    }
    const guardado = {
      id: data,
      telefono: tel,
      nombre: nombre?.trim(),
      direccion: direccion?.trim() || null,
      nota: nota?.trim() || null,
    }
    // Al padrón local en el acto, por lo mismo que la orden: la siguiente búsqueda de ese
    // teléfono no debería depender de que Realtime ya haya pasado.
    guardarClienteLocal(guardado)
    return { cliente: guardado, error: null }
  }

  /** Abre una orden para llevar del cliente y devuelve su id (con el que se navega a la
   *  pantalla de toma de orden). El folio corto lo asigna el backend, consecutivo por
   *  restaurante — es el número que se canta en cocina, un uuid no sirve para eso. */
  async function crearOrden(cliente) {
    const mesero = meseros.find((m) => m.id === currentMeseroId)

    if (IS_MOCK) {
      const folio = ordenes.reduce((max, o) => Math.max(max, o.folio ?? 0), 0) + 1
      const orden = {
        id: uid('llevar'),
        folio,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        clienteTelefono: cliente.telefono,
        direccion: cliente.direccion ?? null,
        meseroId: mesero?.id ?? null,
        meseroNombre: mesero?.nombre ?? '—',
        estado: 'abierta',
        total: 0,
        items: [],
        createdAt: new Date().toISOString(),
        closedAt: null,
      }
      agregarOrdenLocal(orden)
      return { ordenId: orden.id, error: null }
    }

    const { data, error } = await sb.rpc('pos_crear_orden_llevar', {
      p_restaurante_id: restauranteId,
      p_cliente_id: cliente.id,
      p_mesero_id: mesero?.id ?? null,
      p_mesero_nombre: mesero?.nombre ?? '—',
    })
    if (error) {
      console.error('[llevar] crearOrden falló:', error)
      return { ordenId: null, error: error.message }
    }
    // La orden se mete al store en el acto (por eso el RPC devuelve la fila entera): el
    // mesero navega a ella enseguida, y esperar a que Realtime la trajera le pintaba una
    // pantalla de "esta orden ya no está abierta" durante el viaje de ida y vuelta.
    // Realtime la vuelve a escribir igual unos ms después, sin efecto visible.
    agregarOrdenLocal(mapOrden(data))
    return { ordenId: data.id, error: null }
  }

  /** Historial de compras del cliente: sus órdenes ya cerradas, de la más reciente a la
   *  más vieja. En backend se consulta bajo demanda (no se carga el histórico completo
   *  del restaurante en cada tablet) y se lee de la copia congelada en la fila. */
  async function historialCliente(clienteId, limite = 10) {
    if (IS_MOCK) {
      const historial = ordenes
        .filter((o) => o.clienteId === clienteId && o.estado !== 'abierta')
        .sort((a, b) => new Date(b.closedAt ?? b.createdAt) - new Date(a.closedAt ?? a.createdAt))
        .slice(0, limite)
      return { historial, error: null }
    }
    const { data, error } = await sb
      .from('ordenes_llevar')
      .select('*')
      .eq('cliente_id', clienteId)
      .neq('estado', 'abierta')
      .order('closed_at', { ascending: false })
      .limit(limite)
    if (error) {
      console.error('[llevar] historialCliente falló:', error)
      return { historial: [], error: error.message }
    }
    return { historial: (data ?? []).map(mapOrden), error: null }
  }

  return {
    clientes,
    ordenes,
    ordenesAbiertas,
    pedidos,
    buscarPorTelefono,
    guardarCliente,
    crearOrden,
    historialCliente,
  }
}

// Fila de Supabase → forma de la app. Se exportan porque usePosData mapea las mismas
// tablas en la carga inicial y no tiene caso tener dos versiones de esto.
export function mapCliente(row) {
  return {
    id: row.id,
    telefono: row.telefono,
    nombre: row.nombre,
    direccion: row.direccion ?? null,
    nota: row.nota ?? null,
  }
}

export function mapOrden(row) {
  return {
    id: row.id,
    folio: row.folio,
    clienteId: row.cliente_id ?? null,
    clienteNombre: row.cliente_nombre,
    clienteTelefono: row.cliente_telefono,
    direccion: row.direccion ?? null,
    meseroId: row.mesero_id ?? null,
    meseroNombre: row.mesero_nombre,
    estado: row.estado,
    total: Number(row.total ?? 0),
    items: row.items_snapshot ?? [],
    createdAt: row.created_at,
    closedAt: row.closed_at ?? null,
  }
}
