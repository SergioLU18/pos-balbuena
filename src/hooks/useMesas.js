import { useMeseroStore, useOrderStore, usePedidosStore, usePosStore } from '../store/appStore'
import { calcSubtotal } from './useOrderDraft'

/** Mesas visibles para el mesero actual, con su estado derivado (libre / preparando / abierta)
 *  y si la cocina ya dejó algún pedido "listo" para que el mesero lo recoja.
 *  `ignorarFiltro` fuerza a mostrar todas las mesas aunque "solo mis mesas" esté
 *  activo (se usa mientras se edita el mapa del piso, que es una vista global). */
export function useMesas({ ignorarFiltro = false } = {}) {
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const soloMisMesas = useMeseroStore((s) => s.soloMisMesas) && !ignorarFiltro
  const cuentas = useOrderStore((s) => s.cuentas)
  const drafts = useOrderStore((s) => s.drafts)
  const pedidos = usePedidosStore((s) => s.pedidos)
  const MESAS = usePosStore((s) => s.mesas)
  const MESEROS = usePosStore((s) => s.meseros)

  const mesero = MESEROS.find((m) => m.id === currentMeseroId) ?? null

  const mesas = MESAS.filter((m) => !soloMisMesas || mesero?.mesas.includes(m.numero)).map((m) => {
    const cuenta = cuentas[m.id]
    const draft = drafts[m.id] ?? []
    const total = calcSubtotal(cuenta?.items ?? [])
    const tienePedidoListo = pedidos.some((p) => p.mesaId === m.id && p.estado === 'listo')
    const estado = cuenta ? 'abierta' : draft.length > 0 ? 'preparando' : 'libre'
    return {
      ...m,
      estado,
      tienePedidoListo,
      total,
      itemCount: cuenta?.items?.length ?? 0,
      createdAt: cuenta?.createdAt ?? null,
    }
  })

  return { mesas, mesero, meseros: MESEROS }
}
