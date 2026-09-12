import { useEffect, useRef } from 'react'

const ALTO_FILA = 44
const FILAS_VISIBLES = 5
const FILAS_RELLENO = Math.floor(FILAS_VISIBLES / 2)

/** Columna de rueda deslizable (día/mes/año, o cualquier lista corta de opciones):
 *  se desliza con scroll-snap nativo y el valor elegido es el que queda alineado
 *  con la banda central. Tocar una fila la desliza al centro.
 *
 *  `items`: [{ value, label }]. El scroll se reposiciona sin animar cuando `value`
 *  cambia desde afuera (p. ej. al abrir el modal con una fecha ya guardada). */
export function WheelPicker({ items, value, onChange }) {
  const ref = useRef(null)
  const timerRef = useRef(null)
  const indexActual = Math.max(0, items.findIndex((it) => it.value === value))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const destino = indexActual * ALTO_FILA
    if (Math.round(el.scrollTop) !== destino) el.scrollTop = destino
  }, [indexActual])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  // El valor se confirma cuando el scroll se asienta (debounce), no en cada evento:
  // scroll-snap ya se encarga de la inercia y de dejarlo centrado.
  function onScroll() {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const idx = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ALTO_FILA)))
      if (items[idx].value !== value) onChange(items[idx].value)
    }, 120)
  }

  function tocar(idx) {
    ref.current?.scrollTo({ top: idx * ALTO_FILA, behavior: 'smooth' })
  }

  return (
    <div style={{ position: 'relative', flex: 1, height: ALTO_FILA * FILAS_VISIBLES }}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar"
        style={{
          height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory',
          paddingTop: ALTO_FILA * FILAS_RELLENO, paddingBottom: ALTO_FILA * FILAS_RELLENO,
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
        }}
      >
        {items.map((it, i) => (
          <div
            key={it.value}
            onClick={() => tocar(i)}
            style={{
              height: ALTO_FILA, scrollSnapAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Inter Tight', sans-serif", fontSize: 18, fontWeight: 700,
              color: 'var(--jb-ink)', cursor: 'pointer', userSelect: 'none',
            }}
          >
            {it.label}
          </div>
        ))}
      </div>
      {/* Banda central: decorativa, marca qué fila cuenta como elegida. No captura clics. */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)',
          height: ALTO_FILA, pointerEvents: 'none',
          borderTop: '2px solid var(--jb-line)', borderBottom: '2px solid var(--jb-line)',
        }}
      />
    </div>
  )
}
