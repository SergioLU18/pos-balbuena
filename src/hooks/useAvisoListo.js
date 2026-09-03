import { useEffect } from 'react'
import { usePedidosStore, useMeseroStore, usePosStore, useAvisosStore } from '../store/appStore'
import { atiende } from '../lib/asignaciones'
import { sonarListo } from '../lib/sonidos'

// Cuánto tiempo después de que cocina marcó "listo" seguimos considerando oportuno el
// aviso. Es la red de seguridad contra sonar de más al ABRIR la app: si el mesero entra
// y ya había platos listos desde hace rato, no queremos una ráfaga de campanas
// anunciando cosas viejas. 2 min además da margen al desfase de reloj entre la tablet
// de cocina (que es la que escribe listo_at) y la del mesero.
const RECIENTE_MS = 120_000

// Un ÚNICO recordatorio si el plato sigue sin recogerse, pensado contra la falla de oír
// la campana mientras se cruza el salón y olvidarla. APAGADO por ahora: en la prueba real
// pesó más lo molesto de la segunda campana que lo que ayudaba. Se vuelve a encender
// poniendo esta bandera en true — el resto de la maquinaria sigue en su lugar.
const RECORDATORIO_ACTIVO = false
const RECORDATORIO_MS = 90_000

// Estado de cada pedido tal como lo vimos la vuelta pasada. Vive en el MÓDULO, no en el
// efecto: usePosData reemplaza el arreglo completo de pedidos en CADA evento de Realtime
// (cargarTodo), así que sin memoria de la vuelta anterior no habría forma de distinguir
// "acaba de pasar a listo" de "sigue listo desde hace rato", y sonaría en cada recarga.
// Al vivir fuera del componente también sobrevive a un remontaje. Mismo patrón que
// `pagadasVistas` en usePosData.
let estadoVisto = new Map() // pedidoId -> estado
const recordatorios = new Map() // pedidoId -> id de setTimeout

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
      if (p?.estado !== 'listo') return
      sonarListo()
      useAvisosStore.getState().agregarAviso({
        tipo: 'listo',
        titulo: `Mesa ${p.mesaNumero} · sigue esperando`,
        detalle: 'El pedido lleva rato listo y nadie lo ha recogido',
        mesaId: p.mesaId,
      })
    }, RECORDATORIO_MS),
  )
}

/** Suena cuando cocina marca "listo" un pedido QUE MANDÓ el mesero actual.
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

  // Los recordatorios viven en el módulo, así que sobrevivirían a que la app se vuelva a
  // bloquear (cambio de mesero) y sonarían encima del teclado del PIN. Se cancelan al
  // desmontar, que es justo cuando el gate vuelve a tomar la pantalla.
  useEffect(() => () => {
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
      return atiende(asignaciones, p.mesaId, currentMeseroId)
    }

    const ahora = Date.now()
    for (const p of pedidos) {
      const previo = estadoVisto.get(p.id)
      estadoVisto.set(p.id, p.estado)
      if (p.estado !== 'listo') { cancelarRecordatorio(p.id); continue }
      if (previo === 'listo') continue // ya lo anunciamos en una vuelta anterior
      if (!esMio(p)) continue
      const marca = p.listoAt ?? p.estadoActualizadoAt
      if (marca && ahora - new Date(marca).getTime() > RECIENTE_MS) continue
      sonarListo()
      useAvisosStore.getState().agregarAviso({
        tipo: 'listo',
        titulo: `Mesa ${p.mesaNumero} · pedido listo`,
        detalle: 'Cocina lo dejó listo para recoger',
        mesaId: p.mesaId,
      })
      programarRecordatorio(p.id)
    }

    // Pedidos que ya no existen (mesa cobrada en tali, cuenta cerrada): se olvidan para
    // que ni el mapa ni los temporizadores crezcan durante todo el turno.
    const vivos = new Set(pedidos.map((p) => p.id))
    for (const id of [...estadoVisto.keys()]) {
      if (!vivos.has(id)) { estadoVisto.delete(id); cancelarRecordatorio(id) }
    }
  }, [pedidos, currentMeseroId, meseros, asignaciones])
}
