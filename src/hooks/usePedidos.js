import { usePedidosStore, usePosStore } from '../store/appStore'
import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { cargarTodo } from './usePosData'

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

  // Modo mock: muta el store local. Modo backend: mueve la tarjeta en el acto y persiste
  // en Supabase, dejando que Realtime propague el cambio a las demás pantallas.
  //
  // El movimiento local es lo que hace que la tarjeta responda al instante. Antes se
  // esperaba el viaje completo —update → evento de Realtime → debounce de 200 ms →
  // cargarTodo (diez consultas)—, así que pasaban ~2 s entre el toque y el salto de
  // columna: tiempo de sobra para que en cocina creyeran que no había registrado y
  // volvieran a picar. Mismo patrón optimista que cambiarCantidadEnviado en useOrderDraft.
  function avanzarEstado(pedidoId, estado) {
    if (IS_MOCK) return avanzarEstadoLocal(pedidoId, estado)
    avanzarEstadoLocal(pedidoId, estado)
    // Por RPC y no update directo: así el movimiento queda en la bitácora, y la columna
    // de tiempo de la etapa (preparando_at / listo_at / entregado_at) la estampa el
    // servidor con SU reloj — el de cada tablet puede andar desfasado, y los tiempos de
    // cocina se comparan entre tablets.
    //
    // Se firma "Cocina" y no con firma(): este hook solo lo usa el tablero de cocina, que
    // no tiene sesión de mesero. currentMeseroId ahí es el que casualmente quedó guardado
    // en esa tablet, y firmar con él le atribuiría cada comanda movida a un mesero que ni
    // estaba en la cocina.
    sb.rpc('pos_avanzar_pedido', { p_pedido_id: pedidoId, p_estado: estado, p_mesero_nombre: 'Cocina' })
      .then(({ error }) => {
        if (error) {
          console.error('[pedidos] avanzarEstado falló:', error)
          // Recarga autoritativa: si el update no pasó, la tarjeta regresa sola a su
          // columna real en vez de quedarse mintiendo hasta el siguiente evento.
          cargarTodo(usePosStore.getState().restauranteId).catch(() => {})
        }
      })
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
