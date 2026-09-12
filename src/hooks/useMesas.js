import { useMeseroStore, useOrderStore, usePedidosStore, usePosStore, useMesaPagadaStore } from '../store/appStore'
import { meserosDeMesa } from '../lib/asignaciones'
import { sumaCuenta, calcSubtotal } from './useOrderDraft'

/** Mesas visibles para el mesero actual, con su estado derivado. Solo existen dos
 *  estados de cuenta: "abierta" (cualquier parte del proceso — armando el pedido,
 *  enviado a cocina, en preparación, listo para servir — todo se ve igual desde el
 *  piso; el detalle fino de cocina vive en CocinaPage, no aquí) y "pagada" (se cobró,
 *  ya sea en tali o a mano por el mesero — ver cerrarMesa en useOrderDraft). Sin
 *  ninguna de las dos, la mesa está "libre".
 *
 *  Cada mesa trae además `meseros` — los que la atienden, que pueden ser varios — y
 *  `esMia`, que es lo que filtra "solo mis mesas".
 *
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
  const asignaciones = usePosStore((s) => s.asignaciones)

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

    // Los meseros que atienden la mesa, en objetos (no ids) para que la tarjeta del
    // piso los pueda pintar por nombre. Se ignora el id que no resuelve contra el
    // catálogo: un mesero dado de baja sigue teniendo filas en mesa_meseros hasta que
    // el admin lo quite, y no debe aparecer atendiendo nada.
    const meserosMesa = meserosDeMesa(asignaciones, m.id).flatMap((id) => {
      const w = MESEROS.find((x) => x.id === id)
      return w ? [w] : []
    })
    // "Mía" = la atiendo, o tengo un pedido vivo en ella. Lo segundo cubre el hueco
    // entre mandar la orden y que el backend confirme la asignación: sin eso, activar
    // "solo mis mesas" justo después de enviar escondería la mesa que acabo de atender.
    const esMia =
      meserosMesa.some((w) => w.id === currentMeseroId) ||
      pedidos.some((p) => p.mesaId === m.id && p.meseroId === currentMeseroId)

    const estado = abierta ? 'abierta' : pagada ? 'pagada' : 'libre'
    return {
      ...m,
      estado,
      pagada: !!pagada,
      meseros: meserosMesa,
      esMia,
      compartida: meserosMesa.length > 1,
      total,
      itemCount: cuenta?.items?.length ?? 0,
      createdAt: cuenta?.createdAt ?? null,
    }
  })

  // Mesas unidas (ver src/lib/mesasUnidas.js). La secundaria trae `unidaA` (su principal)
  // y la principal trae `unidas` (sus secundarias). Una principal que ya no está en el
  // listado (dada de baja) se ignora: la mesa se pinta como suelta.
  // "Mía" pasa a ser del GRUPO: si atiendo cualquiera de las mesas juntas, "solo mis
  // mesas" me enseña todas, porque en el salón ya son una sola mesa.
  const porId = new Map(base.map((m) => [m.id, m]))
  const mesas = base.map((m) => {
    const principal = m.joined_to ? porId.get(m.joined_to) ?? null : null
    const raiz = principal ?? m
    const grupo = base.filter((x) => x.id === raiz.id || x.joined_to === raiz.id)
    return {
      ...m,
      unidaA: principal ? { id: principal.id, numero: principal.numero } : null,
      unidas: principal ? [] : grupo.filter((x) => x.id !== m.id).map((x) => ({ id: x.id, numero: x.numero })),
      esMia: grupo.some((x) => x.esMia),
    }
  }).filter((m) => !soloMisMesas || m.esMia)

  return { mesas, mesero, meseros: MESEROS }
}
