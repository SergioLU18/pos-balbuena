import { usePedidosStore } from '../store/appStore'
import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'

// Nuevos/Preparando: FIFO (el más antiguo arriba) — así no se deja esperando
// a una mesa que llegó primero. Listos: el más reciente arriba, porque lo que
// importa ahí es qué se acaba de terminar, no cuándo se pidió originalmente.
function porEstado(pedidos, estado, { masRecienteArriba = false } = {}) {
  const filtrados = pedidos.filter((p) => p.estado === estado)
  return filtrados.sort((a, b) => {
    const fechaA = new Date(masRecienteArriba ? (a.estadoActualizadoAt ?? a.enviadoAt) : a.enviadoAt)
    const fechaB = new Date(masRecienteArriba ? (b.estadoActualizadoAt ?? b.enviadoAt) : b.enviadoAt)
    return masRecienteArriba ? fechaB - fechaA : fechaA - fechaB
  })
}

/** Pedidos agrupados por estado para el tablero de cocina (nuevos → preparando → listos). */
export function usePedidos() {
  const pedidos = usePedidosStore((s) => s.pedidos)
  const avanzarEstadoLocal = usePedidosStore((s) => s.avanzarEstado)

  // Modo mock: muta el store local. Modo backend: persiste en Supabase y deja que
  // Realtime propague el cambio a todas las pantallas (mesero y cocina).
  function avanzarEstado(pedidoId, estado) {
    if (IS_MOCK) return avanzarEstadoLocal(pedidoId, estado)
    sb.from('pos_pedidos')
      .update({ estado, estado_actualizado_at: new Date().toISOString() })
      .eq('id', pedidoId)
      .then(({ error }) => { if (error) console.error('[pedidos] avanzarEstado falló:', error) })
  }

  return {
    nuevos: porEstado(pedidos, 'pendiente'),
    preparando: porEstado(pedidos, 'preparando'),
    listos: porEstado(pedidos, 'listo', { masRecienteArriba: true }),
    avanzarEstado,
  }
}
