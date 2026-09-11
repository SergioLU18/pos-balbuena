import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { usePosStore } from '../store/appStore'
import { accionesDelGrupo } from '../lib/eventos'

const POR_PAGINA = 80
const COLUMNAS = 'id, ocurrido_at, mesero_id, mesero_nombre, accion, entidad, entidad_id, etiqueta, detalle'

/** 'YYYY-MM-DD' de hoy según el reloj LOCAL de la tablet. */
export function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Rango [desde, hasta) de un día local, en ISO. Se arma con la fecha local y no con
// UTC: el turno del martes termina a la medianoche de Balbuena, no a la de Greenwich —
// con UTC, todo lo que pasa después de las 6 de la tarde caería en el día siguiente.
function rangoDelDia(dia) {
  const [y, m, d] = dia.split('-').map(Number)
  return [new Date(y, m - 1, d).toISOString(), new Date(y, m - 1, d + 1).toISOString()]
}

function mapEvento(r) {
  return {
    id: r.id,
    ocurridoAt: r.ocurrido_at,
    meseroId: r.mesero_id,
    meseroNombre: r.mesero_nombre,
    accion: r.accion,
    entidad: r.entidad,
    entidadId: r.entidad_id,
    etiqueta: r.etiqueta,
    detalle: r.detalle ?? {},
  }
}

// Paginación por id (keyset) y no por offset: la bitácora crece mientras se lee, y con
// offset un evento nuevo recorrería la página y "Cargar más" repetiría uno ya visto.
async function consultar({ restauranteId, dia, meseroId, grupo, antesDeId }) {
  const [desde, hasta] = rangoDelDia(dia)
  let q = sb
    .from('pos_eventos')
    .select(COLUMNAS)
    .eq('restaurante_id', restauranteId)
    .gte('ocurrido_at', desde)
    .lt('ocurrido_at', hasta)
    .order('id', { ascending: false })
    .limit(POR_PAGINA + 1) // uno de más para saber si hay otra página sin contar
  if (meseroId) q = q.eq('mesero_id', meseroId)
  if (grupo) q = q.in('accion', accionesDelGrupo(grupo))
  if (antesDeId != null) q = q.lt('id', antesDeId)

  const { data, error } = await q
  if (error) {
    console.error('[bitacora] consulta falló:', error)
    return { eventos: [], hayMas: false, error: error.message }
  }
  const filas = data ?? []
  return { eventos: filas.slice(0, POR_PAGINA).map(mapEvento), hayMas: filas.length > POR_PAGINA, error: null }
}

/** Lee la bitácora de un día, del evento más reciente al más viejo.
 *
 *  Sin Realtime a propósito: es una pantalla de consulta, no un tablero. Suscribirla
 *  metería una recarga por cada comanda que se mueve en cocina (el evento más
 *  frecuente) mientras alguien intenta leer; para ver lo nuevo está "Actualizar".
 *
 *  El resultado se guarda junto con la CLAVE de los filtros que lo produjeron. Así
 *  "cargando" se deriva (la clave vigente no coincide con la del resultado) en vez de
 *  prenderse dentro del efecto, y una respuesta lenta de un filtro viejo no pisa la del
 *  filtro nuevo. En modo mock no hay servidor y la bitácora queda vacía. */
export function useBitacora({ dia, meseroId = null, grupo = null }) {
  const restauranteId = usePosStore((s) => s.restauranteId)
  const [version, setVersion] = useState(0)
  const [res, setRes] = useState({ clave: null, eventos: [], hayMas: false, error: null })
  const [cargandoMas, setCargandoMas] = useState(false)

  const activo = !IS_MOCK && !!restauranteId
  const clave = `${restauranteId}|${dia}|${meseroId ?? ''}|${grupo ?? ''}|${version}`

  useEffect(() => {
    if (!activo) return
    let vigente = true
    consultar({ restauranteId, dia, meseroId, grupo }).then((r) => {
      if (vigente) setRes({ clave, ...r })
    })
    return () => { vigente = false }
  }, [activo, clave, restauranteId, dia, meseroId, grupo])

  const alDia = res.clave === clave

  async function cargarMas() {
    if (!activo || !alDia || !res.hayMas || cargandoMas) return
    const claveAlPedir = clave
    const ultimo = res.eventos[res.eventos.length - 1]
    setCargandoMas(true)
    const r = await consultar({ restauranteId, dia, meseroId, grupo, antesDeId: ultimo?.id })
    setCargandoMas(false)
    // Si mientras tanto cambió el filtro, esta página ya no le pertenece a nadie.
    setRes((prev) => (prev.clave !== claveAlPedir
      ? prev
      : { ...prev, eventos: [...prev.eventos, ...r.eventos], hayMas: r.hayMas, error: r.error }))
  }

  return {
    eventos: alDia ? res.eventos : [],
    hayMas: alDia && res.hayMas,
    error: alDia ? res.error : null,
    cargando: activo && !alDia,
    cargandoMas,
    cargarMas,
    recargar: () => setVersion((v) => v + 1),
  }
}
