import { useEffect } from 'react'
import { usePedidosStore, useMeseroStore, usePosStore, useAvisosStore } from '../store/appStore'
import { atiende } from '../lib/asignaciones'
import { sonarListo } from '../lib/sonidos'

// El aviso ya no depende de que cocina marque "listo": ahora es puramente por tiempo,
// a partir de que el pedido se mandó a cocina (enviadoAt). Cocina tarda variable y el
// mesero necesita un recordatorio confiable para ir a preguntar, sin depender de que
// alguien en cocina toque el tablero.
const AVISO_MS = 5 * 60 * 1000

// Red de seguridad contra sonar de más al ABRIR la app: si el mesero entra y ya hay
// pedidos cuyos 5 minutos vencieron hace rato, no queremos una ráfaga de campanas
// anunciando cosas viejas de golpe. Si el vencimiento fue reciente, sí se avisa.
const RECIENTE_MS = 120_000

// Un ÚNICO recordatorio si el plato sigue sin recogerse, pensado contra la falla de oír
// la campana mientras se cruza el salón y olvidarla. APAGADO por ahora: en la prueba real
// pesó más lo molesto de la segunda campana que lo que ayudaba. Se vuelve a encender
// poniendo esta bandera en true — el resto de la maquinaria sigue en su lugar.
const RECORDATORIO_ACTIVO = false
const RECORDATORIO_MS = 90_000

// Qué pedidos ya se avisaron (para no repetir) y qué temporizadores siguen esperando su
// marca de 5 minutos. Viven en el MÓDULO, no en el efecto: usePosData reemplaza el
// arreglo completo de pedidos en cada evento de Realtime (cargarTodo), así que sin esta
// memoria no habría forma de saber "a este ya lo programé/avisé" entre una recarga y
// otra. Al vivir fuera del componente también sobreviven a un remontaje. Mismo patrón
// que `pagadasVistas` en usePosData.
const avisados = new Set() // pedidoId
const temporizadores = new Map() // pedidoId -> id de setTimeout
const recordatorios = new Map() // pedidoId -> id de setTimeout

// Quién es el destinatario del pedido, tal como se lee en el aviso: la mesa, o el cliente
// cuando es para llevar (esas comandas no tienen mesa).
const dueño = (p) => (p.tipo === 'llevar' ? `Para llevar · ${p.clienteNombre ?? 'Cliente'}` : `Mesa ${p.mesaNumero}`)

// A dónde lleva tocar el aviso en la campana. Sin esto, un aviso de una comanda para
// llevar mandaba a /mesero/orden/null.
const rutaDelPedido = (p) =>
  p.tipo === 'llevar'
    ? (p.ordenLlevarId ? `/mesero/llevar/orden/${p.ordenLlevarId}` : '/mesero/llevar')
    : (p.mesaId ? `/mesero/orden/${p.mesaId}` : null)

function cancelarTemporizador(pedidoId) {
  const t = temporizadores.get(pedidoId)
  if (t) { clearTimeout(t); temporizadores.delete(pedidoId) }
}

function cancelarRecordatorio(pedidoId) {
  const t = recordatorios.get(pedidoId)
  if (t) { clearTimeout(t); recordatorios.delete(pedidoId) }
}

function programarRecordatorio(pedidoId) {
  if (!RECORDATORIO_ACTIVO) return
  cancelarRecordatorio(pedidoId)
  recordatorios.set(
    pedidoId,
    setTimeout(() => {
      recordatorios.delete(pedidoId)
      // Se relee el estado al disparar: si el mesero ya lo recogió, no hay nada que
      // recordar. No se reprograma — máximo dos campanas por pedido, a propósito.
      const p = usePedidosStore.getState().pedidos.find((x) => x.id === pedidoId)
      if (p?.estado === 'entregado') return
      sonarListo()
      useAvisosStore.getState().agregarAviso({
        tipo: 'listo',
        titulo: `${dueño(p)} · sigue esperando`,
        detalle: 'El pedido lleva rato esperando y nadie lo ha recogido',
        mesaId: p.mesaId,
        ruta: rutaDelPedido(p),
      })
    }, RECORDATORIO_MS),
  )
}

function dispararAviso(p) {
  avisados.add(p.id)
  sonarListo()
  useAvisosStore.getState().agregarAviso({
    tipo: 'listo',
    titulo: `${dueño(p)} · pedido listo`,
    detalle: 'Ya pasaron 5 minutos desde que se mandó a cocina',
    mesaId: p.mesaId,
    ruta: rutaDelPedido(p),
  })
  programarRecordatorio(p.id)
}

/** Avisa 5 minutos después de que el mesero actual mandó un pedido a cocina, sin
 *  esperar a que cocina lo marque "listo" en su tablero.
 *
 *  Se sigue el pedido y no la mesa: una mesa puede tener varios meseros, y sonarles a
 *  todos por el mismo plato dejaba a nadie sabiendo si le tocaba ir por él. El pedido,
 *  en cambio, siempre tiene un dueño — el que lo envió.
 *
 *  Se monta en TabletShell, que es el primer punto donde la app ya pasó el gate del PIN
 *  y que sigue montado en las dos rutas del mesero. Lo primero evita que el aviso suene
 *  con el teclado del PIN en pantalla; lo segundo, que el aviso llegue igual cuando el
 *  mesero está dentro de la orden de OTRA mesa y no ve el pulso de la tarjeta. */
export function useAvisoListo() {
  const pedidos = usePedidosStore((s) => s.pedidos)
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const meseros = usePosStore((s) => s.meseros)
  const asignaciones = usePosStore((s) => s.asignaciones)

  // Los temporizadores viven en el módulo, así que sobrevivirían a que la app se vuelva a
  // bloquear (cambio de mesero) y sonarían encima del teclado del PIN. Se cancelan al
  // desmontar, que es justo cuando el gate vuelve a tomar la pantalla.
  useEffect(() => () => {
    for (const id of [...temporizadores.keys()]) cancelarTemporizador(id)
    for (const id of [...recordatorios.keys()]) cancelarRecordatorio(id)
  }, [])

  useEffect(() => {
    const mesero = meseros.find((m) => m.id === currentMeseroId) ?? null
    const nombresConocidos = new Set(meseros.map((m) => m.nombre))
    // Por id, que es la referencia real. El nombre es el respaldo para los pedidos
    // creados antes de que existiera pedidos.mesero_id, y solo cuenta si identifica a
    // un mesero del catálogo: si el pedido no tiene dueño reconocible (base vieja, o el
    // mesero se dio de baja) suena para todos los que atienden la mesa — más vale
    // avisar de más que dejar un plato enfriándose sin dueño.
    const esMio = (p) => {
      if (p.meseroId) return p.meseroId === currentMeseroId
      if (p.meseroNombre && nombresConocidos.has(p.meseroNombre)) return p.meseroNombre === mesero?.nombre
      // Una comanda para llevar sin dueño reconocible no tiene mesa contra la cual
      // preguntar, así que suena para todos — mismo criterio que abajo: más vale avisar
      // de más que dejar un pedido enfriándose sin que nadie lo recoja.
      if (p.tipo === 'llevar') return true
      return atiende(asignaciones, p.mesaId, currentMeseroId)
    }

    const ahora = Date.now()
    for (const p of pedidos) {
      // Ya se avisó, o ya está programado para avisar: nada que hacer en esta vuelta.
      if (avisados.has(p.id) || temporizadores.has(p.id)) continue
      if (!p.enviadoAt || !esMio(p)) continue
      // Ya lo recogieron: no tiene caso avisar que "sigue esperando" de algo entregado.
      if (p.estado === 'entregado') { avisados.add(p.id); continue }

      const objetivo = new Date(p.enviadoAt).getTime() + AVISO_MS
      const faltante = objetivo - ahora
      if (faltante <= 0) {
        // El plazo ya venció: si venció hace poco, se avisa ahora; si es viejo (la app se
        // acaba de abrir y ya llevaba rato así), se marca como visto sin sonar de golpe.
        if (-faltante <= RECIENTE_MS) dispararAviso(p)
        else avisados.add(p.id)
        continue
      }

      temporizadores.set(
        p.id,
        setTimeout(() => {
          temporizadores.delete(p.id)
          // Se relee el pedido al disparar: si ya lo entregaron o la mesa se cobró
          // (pedido desaparecido) entre que se programó el timer y que venció, no hay
          // nada que avisar.
          const actual = usePedidosStore.getState().pedidos.find((x) => x.id === p.id)
          if (!actual || actual.estado === 'entregado') return
          dispararAviso(actual)
        }, faltante),
      )
    }

    // Pedidos que ya no existen (mesa cobrada en tali, cuenta cerrada): se olvidan para
    // que ni los sets/mapas ni los temporizadores crezcan durante todo el turno.
    const vivos = new Set(pedidos.map((p) => p.id))
    for (const id of [...avisados]) if (!vivos.has(id)) avisados.delete(id)
    for (const id of [...temporizadores.keys()]) if (!vivos.has(id)) cancelarTemporizador(id)
    for (const id of [...recordatorios.keys()]) if (!vivos.has(id)) cancelarRecordatorio(id)
  }, [pedidos, currentMeseroId, meseros, asignaciones])
}
