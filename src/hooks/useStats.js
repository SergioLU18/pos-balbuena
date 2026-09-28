import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { usePosStore } from '../store/appStore'

/** Motor compartido de los hooks de abajo: llama una RPC `pos_stats_*` y guarda el
 *  resultado junto con la CLAVE de los argumentos que lo produjeron — mismo patrón
 *  que useBitacora.useBitacora: "cargando" se deriva de que la clave vigente no
 *  coincide con la del resultado, así una respuesta lenta de un rango viejo (el
 *  dueño cambió de "Hoy" a "Mes" antes de que llegara) no pisa la del rango nuevo.
 *
 *  `clave` ya es la representación completa de `params` (la arma cada hook de
 *  abajo), así que el efecto solo necesita re-disparar cuando `clave` cambia —
 *  `nombreRPC`/`params` se leen frescos en cada llamada pero no son una fuente de
 *  cambio independiente de `clave`. */
function useStatRPC(nombreRPC, params, activo, clave) {
  const [res, setRes] = useState({ clave: null, datos: null, error: null })

  useEffect(() => {
    if (!activo) return
    let vigente = true
    sb.rpc(nombreRPC, params).then(({ data, error }) => {
      if (!vigente) return
      if (error) console.error(`[stats] ${nombreRPC} falló:`, error)
      setRes({ clave, datos: error ? null : (data ?? null), error: error?.message ?? null })
    })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nombreRPC/params se derivan de lo mismo que arma `clave`; ver comentario de arriba.
  }, [activo, clave])

  const alDia = res.clave === clave
  return { datos: alDia ? res.datos : null, cargando: activo && !alDia, error: alDia ? res.error : null }
}

/** Total del periodo, salón vs. llevar y corte por método de pago (ver
 *  supabase/stats.sql). `desde`/`hasta` son ISO — o null para no pedir nada
 *  todavía (p. ej. mientras se arma el rango de "Personalizado"). */
export function useResumenStats(desde, hasta) {
  const restauranteId = usePosStore((s) => s.restauranteId)
  const activo = !IS_MOCK && !!restauranteId && !!desde && !!hasta
  const clave = activo ? `resumen|${restauranteId}|${desde}|${hasta}` : null
  return useStatRPC('pos_stats_resumen', { p_restaurante_id: restauranteId, p_desde: desde, p_hasta: hasta }, activo, clave)
}

/** Top platillos del periodo, por dinero y por unidades. */
export function usePlatillosStats(desde, hasta, limite = 8) {
  const restauranteId = usePosStore((s) => s.restauranteId)
  const activo = !IS_MOCK && !!restauranteId && !!desde && !!hasta
  const clave = activo ? `platillos|${restauranteId}|${desde}|${hasta}|${limite}` : null
  return useStatRPC('pos_stats_platillos', { p_restaurante_id: restauranteId, p_desde: desde, p_hasta: hasta, p_limite: limite }, activo, clave)
}

/** Venta enviada a cocina, tickets atendidos y ticket promedio, por mesero. */
export function useMeserosStats(desde, hasta) {
  const restauranteId = usePosStore((s) => s.restauranteId)
  const activo = !IS_MOCK && !!restauranteId && !!desde && !!hasta
  const clave = activo ? `meseros|${restauranteId}|${desde}|${hasta}` : null
  return useStatRPC('pos_stats_meseros', { p_restaurante_id: restauranteId, p_desde: desde, p_hasta: hasta }, activo, clave)
}

/** Una fila por cada mesa/orden-para-llevar cerrada en el rango: alimenta el
 *  heatmap hora×día, el ranking de días de la semana y el acumulado del mes — los
 *  tres bucketean en el navegador por hora/día LOCAL (ver statsRangos.js). */
export function useVentasSerie(desde, hasta) {
  const restauranteId = usePosStore((s) => s.restauranteId)
  const activo = !IS_MOCK && !!restauranteId && !!desde && !!hasta
  const clave = activo ? `serie|${restauranteId}|${desde}|${hasta}` : null
  const { datos, cargando, error } = useStatRPC('pos_stats_ventas_serie', { p_restaurante_id: restauranteId, p_desde: desde, p_hasta: hasta }, activo, clave)
  return { datos: datos ?? [], cargando, error }
}

/** Corte de caja de un horario específico (no del día calendario completo): salón +
 *  para llevar juntos, por método de pago, más propina (ver supabase/cierre_dia.sql).
 *  A diferencia de los demás hooks de este archivo, este no se dispara solo al
 *  cambiar `desde`/`hasta` — lo llama el propio modal de "Cierre del Día" con
 *  `calcular()`, para que abrir el modal no dispare la consulta antes de que el
 *  admin confirme el horario. */
export function useCierreDia() {
  const restauranteId = usePosStore((s) => s.restauranteId)
  const [estado, setEstado] = useState({ datos: null, cargando: false, error: null })

  function calcular(desde, hasta) {
    if (IS_MOCK || !restauranteId) return
    setEstado({ datos: null, cargando: true, error: null })
    sb.rpc('pos_stats_cierre_dia', { p_restaurante_id: restauranteId, p_desde: desde, p_hasta: hasta })
      .then(({ data, error }) => {
        if (error) {
          console.error('[stats] pos_stats_cierre_dia falló:', error)
          setEstado({ datos: null, cargando: false, error: error.message })
          return
        }
        setEstado({ datos: data, cargando: false, error: null })
      })
  }

  function limpiar() {
    setEstado({ datos: null, cargando: false, error: null })
  }

  return { ...estado, calcular, limpiar }
}

/** Frecuencia de compra del padrón para llevar — de siempre, no por periodo (ver
 *  supabase/stats.sql: es la única identidad de cliente que el POS conoce). */
export function useFrecuenciaClientesStats() {
  const restauranteId = usePosStore((s) => s.restauranteId)
  const activo = !IS_MOCK && !!restauranteId
  const clave = activo ? `frecuencia|${restauranteId}` : null
  return useStatRPC('pos_stats_clientes_frecuencia', { p_restaurante_id: restauranteId }, activo, clave)
}
