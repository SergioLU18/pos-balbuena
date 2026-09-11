import { useMeseroStore, useOrderStore, usePedidosStore, usePosStore, useMesaPagadaStore } from '../store/appStore'
import { meserosDeMesa } from '../lib/asignaciones'
import { sumaCuenta } from './useOrderDraft'

/** Mesas visibles para el mesero actual, con su estado derivado (libre / preparando / abierta),
 *  si cocina ya está cocinando algún pedido de la mesa, y si ya dejó alguno "listo" para
 *  que el mesero lo recoja.
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
    const pagada = pagadas[m.id] ?? null
    const total = cuenta ? sumaCuenta(cuenta.items ?? []) : pagada ? pagada.total : 0
    const tienePedidoListo = pedidos.some((p) => p.mesaId === m.id && p.estado === 'listo')
    const tieneEnPreparacion = pedidos.some((p) => p.mesaId === m.id && p.estado === 'preparando')
    const tienePedidoPendiente = pedidos.some((p) => p.mesaId === m.id && p.estado === 'pendiente')

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
