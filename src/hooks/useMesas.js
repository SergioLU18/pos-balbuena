import { useMeseroStore, useOrderStore, usePosStore, useMesaPagadaStore } from '../store/appStore'
import { sumaCuenta, calcSubtotal } from './useOrderDraft'

/** Mesas visibles para el mesero actual, con su estado derivado. Solo existen dos
 *  estados de cuenta: "abierta" (cualquier parte del proceso — armando el pedido,
 *  enviado a cocina, en preparación, listo para servir — todo se ve igual desde el
 *  piso; el detalle fino de cocina vive en CocinaPage, no aquí) y "pagada" (se cobró,
 *  ya sea en tali o a mano por el mesero — ver cerrarMesa en useOrderDraft). Sin
 *  ninguna de las dos, la mesa está "libre". */
export function useMesas() {
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const cuentas = useOrderStore((s) => s.cuentas)
  const drafts = useOrderStore((s) => s.drafts)
  const pagadas = useMesaPagadaStore((s) => s.pagadas)
  const MESAS = usePosStore((s) => s.mesas)
  const MESEROS = usePosStore((s) => s.meseros)

  const mesero = MESEROS.find((m) => m.id === currentMeseroId) ?? null

  const base = MESAS.map((m) => {
    const cuenta = cuentas[m.id]
    const draft = drafts[m.id] ?? []
    const abierta = !!cuenta || draft.length > 0
    // pagada solo aplica cuando la mesa no se reabrió: agregar el primer platillo del
    // draft ya apaga el badge al instante (ver agregarPlatillo/agregarItemConstruido en
    // useOrderDraft), esto es nomás la red de seguridad de la derivación.
    const pagada = !abierta ? (pagadas[m.id] ?? null) : null
    const total = cuenta ? sumaCuenta(cuenta.items ?? []) : draft.length > 0 ? calcSubtotal(draft) : pagada ? pagada.total : 0

    const estado = abierta ? 'abierta' : pagada ? 'pagada' : 'libre'
    return {
      ...m,
      estado,
      pagada: !!pagada,
      total,
      itemCount: cuenta?.items?.length ?? 0,
      createdAt: cuenta?.createdAt ?? null,
    }
  })

  // Mesas unidas (ver src/lib/mesasUnidas.js). La secundaria trae `unidaA` (su principal)
  // y la principal trae `unidas` (sus secundarias). Una principal que ya no está en el
  // listado (dada de baja) se ignora: la mesa se pinta como suelta.
  const porId = new Map(base.map((m) => [m.id, m]))
  const mesas = base.map((m) => {
    const principal = m.joined_to ? porId.get(m.joined_to) ?? null : null
    const raiz = principal ?? m
    const grupo = base.filter((x) => x.id === raiz.id || x.joined_to === raiz.id)
    return {
      ...m,
      unidaA: principal ? { id: principal.id, numero: principal.numero } : null,
      unidas: principal ? [] : grupo.filter((x) => x.id !== m.id).map((x) => ({ id: x.id, numero: x.numero })),
    }
  })

  return { mesas, mesero, meseros: MESEROS }
}
