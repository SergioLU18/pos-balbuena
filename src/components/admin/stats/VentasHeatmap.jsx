import { useMemo, useState } from 'react'
import { Section, AvisoVacio } from './Section'
import { f } from '../../../lib/utils'
import { bucketizarHeatmap } from '../../../lib/statsCalc'
import { NOMBRES_DIA, ORDEN_SEMANA } from '../../../lib/statsRangos'
import { SECUENCIAL_ROSA } from '../../../lib/statsColors'

// Bloques de 2 horas (0-2, 2-4, … 22-24) y no las 24 horas sueltas: en vertical
// de tableta 24 columnas quedan demasiado angostas para tocarlas — 12 sigue
// mostrando el patrón que hace falta para programar personal (dónde está la
// comida y dónde la cena) sin perder el dedo entre columnas.
const BLOQUES = Array.from({ length: 12 }, (_, i) => i * 2)

function fusionarEn2h(grillaHoraria) {
  // grillaHoraria: [dow][hora] -> { total, cuentas }. Junta cada par de horas.
  return grillaHoraria.map((fila) =>
    BLOQUES.map((h) => ({
      total: fila[h].total + fila[h + 1].total,
      cuentas: fila[h].cuentas + fila[h + 1].cuentas,
    }))
  )
}

function colorDe(total, maximo) {
  if (total <= 0 || maximo <= 0) return SECUENCIAL_ROSA[0]
  const paso = Math.min(SECUENCIAL_ROSA.length - 1, 1 + Math.floor((total / maximo) * (SECUENCIAL_ROSA.length - 2)))
  return SECUENCIAL_ROSA[paso]
}

/** A qué hora entra el dinero, últimos 30 días: la stat que decide cuánta gente
 *  programar y cuándo. Toca una celda para ver su detalle — en tableta no hay
 *  hover, así que la lectura vive en un renglón fijo arriba de la grilla. */
export function VentasHeatmap({ serie, cargando }) {
  const [seleccion, setSeleccion] = useState(null)

  const { filas, maximo, pico } = useMemo(() => {
    const grilla = fusionarEn2h(bucketizarHeatmap(serie))
    const filasOrdenadas = ORDEN_SEMANA.map((dow) => ({ dow, nombre: NOMBRES_DIA[dow], celdas: grilla[dow] }))
    let maximoLocal = 0
    let picoLocal = null
    filasOrdenadas.forEach((fila) => {
      fila.celdas.forEach((celda, i) => {
        if (celda.total > maximoLocal) maximoLocal = celda.total
        if (!picoLocal || celda.total > picoLocal.total) picoLocal = { ...celda, dow: fila.dow, nombre: fila.nombre, hora: BLOQUES[i] }
      })
    })
    return { filas: filasOrdenadas, maximo: maximoLocal, pico: picoLocal }
  }, [serie])

  const hayDatos = maximo > 0
  const mostrar = seleccion ?? (hayDatos ? pico : null)

  return (
    <Section title="A qué hora entra el dinero" subtitle="Últimos 30 días, agrupado en bloques de 2 horas.">
      {cargando && !serie.length ? (
        <AvisoVacio>Cargando…</AvisoVacio>
      ) : !hayDatos ? (
        <AvisoVacio>Sin ventas cerradas en los últimos 30 días.</AvisoVacio>
      ) : (
        <>
          <div style={{
            background: 'var(--jb-cream)', borderRadius: 12, padding: '10px 14px',
            fontSize: 14, fontWeight: 700, color: 'var(--jb-ink)', minHeight: 20,
          }}>
            {mostrar ? (
              <>
                <strong>{mostrar.nombre} {String(mostrar.hora).padStart(2, '0')}:00–{String(mostrar.hora + 2).padStart(2, '0')}:00</strong>
                {' · '}{f(mostrar.total)} · {mostrar.cuentas} cuenta{mostrar.cuentas === 1 ? '' : 's'}
                {!seleccion && <span style={{ color: 'var(--jb-ink-soft)', fontWeight: 700 }}> (el bloque más fuerte)</span>}
              </>
            ) : 'Toca una celda para ver el detalle.'}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '42px repeat(12, minmax(22px, 1fr))', gap: 3, minWidth: 460 }}>
              <div />
              {BLOQUES.map((h) => (
                <div key={h} style={{ fontSize: 10, fontWeight: 800, color: 'var(--jb-ink-soft)', textAlign: 'center' }}>
                  {h % 4 === 0 ? h : ''}
                </div>
              ))}
              {filas.map((fila) => (
                <FilaHeatmap key={fila.dow} fila={fila} maximo={maximo} seleccion={seleccion} onSeleccionar={setSeleccion} />
              ))}
            </div>
          </div>
        </>
      )}
    </Section>
  )
}

function FilaHeatmap({ fila, maximo, seleccion, onSeleccionar }) {
  return (
    <>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--jb-ink-soft)', display: 'flex', alignItems: 'center' }}>
        {fila.nombre.slice(0, 3)}
      </div>
      {fila.celdas.map((celda, i) => {
        const hora = BLOQUES[i]
        const activa = seleccion?.dow === fila.dow && seleccion?.hora === hora
        return (
          <button
            key={hora}
            type="button"
            onClick={() => onSeleccionar({ ...celda, dow: fila.dow, nombre: fila.nombre, hora })}
            aria-label={`${fila.nombre} ${hora}:00 a ${hora + 2}:00 — ${f(celda.total)}, ${celda.cuentas} cuentas`}
            style={{
              aspectRatio: '1', border: activa ? '2px solid var(--jb-ink)' : '1px solid var(--jb-line)',
              borderRadius: 5, background: colorDe(celda.total, maximo), padding: 0, cursor: 'pointer', minHeight: 22,
            }}
          />
        )
      })}
    </>
  )
}
