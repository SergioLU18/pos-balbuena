import { useEffect, useState } from 'react'

/** Reloj que se actualiza cada `intervalMs` (10s por default) — también sirve para
 *  refrescar textos de "tiempo transcurrido". Los cronómetros en vivo (MIN:SEG de
 *  las tarjetas de cocina) piden un intervalo de 1s para que se vean avanzar los
 *  segundos.
 *
 *  Guarda el timestamp crudo (no el string formateado) porque, formateado a solo
 *  HH:MM, dos ticks dentro del mismo minuto producen el mismo string — y React no
 *  vuelve a renderizar si el nuevo estado es idéntico al anterior. Con el timestamp
 *  crudo el estado siempre cambia, así que el intervalo de verdad fuerza el re-render
 *  (necesario para que el segundero de las tarjetas de cocina se vea avanzar). */
export function useClock(intervalMs = 10000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return new Date(now).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}
