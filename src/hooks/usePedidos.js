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

  // Columna de tiempo propia de cada etapa (además de estado_actualizado_at): así el
  // cronómetro de la tarjeta se puede reiniciar por columna, y el tiempo en "listo"
  // queda congelado en la fila al llegar a "entregado" (útil para reportes después).
  const COLUMNA_TIEMPO = { preparando: 'preparando_at', listo: 'listo_at', entregado: 'entregado_at' }

  // Modo mock: muta el store local. Modo backend: persiste en Supabase y deja que
  // Realtime propague el cambio a todas las pantallas (mesero y cocina).
  function avanzarEstado(pedidoId, estado) {
    if (IS_MOCK) return avanzarEstadoLocal(pedidoId, estado)
    const ahora = new Date().toISOString()
    const columna = COLUMNA_TIEMPO[estado]
    sb.from('pedidos')
      .update({ estado, estado_actualizado_at: ahora, ...(columna ? { [columna]: ahora } : {}) })
      .eq('id', pedidoId)
      .then(({ error }) => { if (error) console.error('[pedidos] avanzarEstado falló:', error) })
  }

  return {
    nuevos: porEstado(pedidos, 'pendiente'),
    preparando: porEstado(pedidos, 'preparando'),
    listos: porEstado(pedidos, 'listo', { masRecienteArriba: true }),
    // Backlog de comandas ya recogidas por el mesero: la que se acaba de recoger arriba.
    entregados: porEstado(pedidos, 'entregado', { masRecienteArriba: true }),
    avanzarEstado,
  }
}
