import { useMeseroStore, useOrderStore, usePedidosStore, usePosStore, useMesaPagadaStore } from '../store/appStore'
import { sumaCuenta } from './useOrderDraft'

/** Mesas visibles para el mesero actual, con su estado derivado (libre / preparando / abierta),
 *  si cocina ya está cocinando algún pedido de la mesa, y si ya dejó alguno "listo" para
 *  que el mesero lo recoja.
 *  `ignorarFiltro` fuerza a mostrar todas las mesas aunque "solo mis mesas" esté
 *  activo (se usa mientras se edita el mapa del piso, que es una vista global). */
export function useMesas({ ignorarFiltro = false } = {}) {
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const soloMisMesas = useMeseroStore((s) => s.soloMisMesas) && !ignorarFiltro
  const cuentas = useOrderStore((s) => s.cuentas)
  const drafts = useOrderStore((s) => s.drafts)
  const pedidos = usePedidosStore((s) => s.pedidos)
  const pagadas = useMesaPagadaStore((s) => s.pagadas)
  const MESAS = usePosStore((s) => s.mesas)
  const MESEROS = usePosStore((s) => s.meseros)

  const mesero = MESEROS.find((m) => m.id === currentMeseroId) ?? null

  const mesas = MESAS.filter((m) => !soloMisMesas || mesero?.mesas.includes(m.numero)).map((m) => {
    const cuenta = cuentas[m.id]
    const draft = drafts[m.id] ?? []
    const pagada = pagadas[m.id] ?? null
    const total = cuenta ? sumaCuenta(cuenta.items ?? []) : pagada ? pagada.total : 0
    const tienePedidoListo = pedidos.some((p) => p.mesaId === m.id && p.estado === 'listo')
    const tieneEnPreparacion = pedidos.some((p) => p.mesaId === m.id && p.estado === 'preparando')
    const tienePedidoPendiente = pedidos.some((p) => p.mesaId === m.id && p.estado === 'pendiente')
    // Prioridad de estado: cuenta abierta > armando pedido (draft) > pagada (efímera) > libre.
    // pagada solo aplica cuando ya no hay cuenta ni draft (el mesero no reabrió la mesa).
    const estado = cuenta ? 'abierta' : draft.length > 0 ? 'preparando' : pagada ? 'pagada' : 'libre'
    return {
      ...m,
      estado,
      pagada: !!pagada,
      tienePedidoListo,
      tieneEnPreparacion,
      tienePedidoPendiente,
      total,
      itemCount: cuenta?.items?.length ?? 0,
      createdAt: cuenta?.createdAt ?? null,
    }
  })

  return { mesas, mesero, meseros: MESEROS }
}
