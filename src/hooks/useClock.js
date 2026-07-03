import { useEffect, useState } from 'react'

/** Reloj que se actualiza cada 10s — también sirve para refrescar textos de "tiempo transcurrido". */
export function useClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const t = setInterval(tick, 10000)
    return () => clearInterval(t)
  }, [])
  return time
}
