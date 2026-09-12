import { useMemo, useState } from 'react'
import { IS_MOCK } from '../../../lib/config'
import {
  ymdLocal, rangoDia, rangoSemana, rangoMes, rangoPersonalizado,
  rangoAnterior, rangoSemanaPasada, rangoUltimosDias, diaDelMes, diasEnMes, NOMBRES_DIA,
} from '../../../lib/statsRangos'
import { useResumenStats, usePlatillosStats, useMeserosStats, useVentasSerie, useFrecuenciaClientesStats } from '../../../hooks/useStats'
import { PeriodoTabs } from './PeriodoTabs'
import { ResumenCards } from './ResumenCards'
import { MetodosPagoDonut } from './MetodosPagoDonut'
import { TopPlatillos } from './TopPlatillos'
import { VentaPorMesero } from './VentaPorMesero'
import { VentasHeatmap } from './VentasHeatmap'
import { PatronesMes } from './PatronesMes'
import { FrecuenciaClientes } from './FrecuenciaClientes'
import { CumpleanosMes } from './CumpleanosMes'
import { AvisoVacio } from './Section'

const ETIQUETA_ANTERIOR = { dia: 'vs. ayer', semana: 'vs. semana pasada', mes: 'vs. mes pasado', personalizado: 'vs. periodo anterior' }

/** Ajustes → Bitácora → Estadísticas. Todo lo que se corta por periodo cuelga
 *  de un solo selector (Hoy/Semana/Mes/Personalizado); el heatmap y "patrones
 *  del mes" son fijos a propósito (últimos 30 días y mes calendario en curso,
 *  ver sus propios comentarios) — moverlos con el selector no tendría sentido
 *  para lo que responden. */
export function EstadisticasSection() {
  const hoy = ymdLocal()
  const [periodo, setPeriodo] = useState('dia')
  const [personalizado, setPersonalizado] = useState({ desde: hoy, hasta: hoy })

  const rango = useMemo(() => {
    if (periodo === 'dia') return rangoDia(hoy)
    if (periodo === 'semana') return rangoSemana(hoy)
    if (periodo === 'mes') return rangoMes(hoy)
    return rangoPersonalizado(personalizado.desde, personalizado.hasta)
  }, [periodo, personalizado, hoy])

  const anterior = useMemo(() => rangoAnterior(rango), [rango])
  const mostrarSemanaPasada = periodo === 'dia'
  const semanaPasada = useMemo(() => (mostrarSemanaPasada ? rangoSemanaPasada(rango) : null), [rango, mostrarSemanaPasada])
  const etiquetaSemanaPasada = mostrarSemanaPasada ? `vs. ${NOMBRES_DIA[new Date(rango.desde).getDay()].toLowerCase()} pasado` : null

  // Fijos: no dependen del selector de arriba (ver comentario de la función).
  const rangoHeatmap = useMemo(() => rangoUltimosDias(30, hoy), [hoy])
  const rangoMesActual = useMemo(() => ({ desde: rangoMes(hoy).desde, hasta: new Date().toISOString() }), [hoy])

  const resumenActual = useResumenStats(rango.desde, rango.hasta)
  const resumenAnterior = useResumenStats(anterior.desde, anterior.hasta)
  const resumenSemanaPasada = useResumenStats(semanaPasada?.desde ?? null, semanaPasada?.hasta ?? null)
  const platillos = usePlatillosStats(rango.desde, rango.hasta)
  const meseros = useMeserosStats(rango.desde, rango.hasta)
  const heatmap = useVentasSerie(rangoHeatmap.desde, rangoHeatmap.hasta)
  const mesActual = useVentasSerie(rangoMesActual.desde, rangoMesActual.hasta)
  const frecuencia = useFrecuenciaClientesStats()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 900, color: 'var(--jb-ink)' }}>Estadísticas</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--jb-ink-soft)' }}>Ventas, clientes y patrones del restaurante.</p>
        <PeriodoTabs periodo={periodo} onPeriodo={setPeriodo} personalizado={personalizado} onPersonalizado={setPersonalizado} />
      </div>

      {IS_MOCK ? (
        <AvisoVacio>Las estadísticas se calculan en el servidor. En modo demo no hay nada que mostrar.</AvisoVacio>
      ) : (
        <>
          <ResumenCards
            actual={resumenActual.datos} anterior={resumenAnterior.datos} semanaPasada={resumenSemanaPasada.datos}
            etiquetaAnterior={ETIQUETA_ANTERIOR[periodo]} etiquetaSemanaPasada={etiquetaSemanaPasada}
            cargando={resumenActual.cargando}
          />
          <MetodosPagoDonut resumen={resumenActual.datos} cargando={resumenActual.cargando} />
          <TopPlatillos datos={platillos.datos} cargando={platillos.cargando} />
          <VentaPorMesero datos={meseros.datos} cargando={meseros.cargando} />
          <VentasHeatmap serie={heatmap.datos} cargando={heatmap.cargando} />
          <PatronesMes serie={mesActual.datos} diaDelMes={diaDelMes(hoy)} diasEnMes={diasEnMes(hoy)} cargando={mesActual.cargando} />
          <FrecuenciaClientes datos={frecuencia.datos} cargando={frecuencia.cargando} />
          <CumpleanosMes />
        </>
      )}
    </div>
  )
}
