import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMesas } from '../../hooks/useMesas'
import { useMesaLayout } from '../../hooks/useMesaLayout'
import { useMeseroStore } from '../../store/appStore'
import { MesaCard, MESA_CARD_W, MESA_CARD_H } from '../../components/mesero/MesaCard'

const GAP = 18

/** Posición por defecto (antes de que el mesero acomode algo): la misma
 *  cuadrícula compacta de siempre — tantas columnas como quepan en el ancho
 *  disponible, pegadas entre sí con el mismo espaciado que antes. */
function posicionPorDefecto(index, anchoDisponible) {
  const cols = Math.max(1, Math.floor((anchoDisponible + GAP) / (MESA_CARD_W + GAP)))
  const col = index % cols
  const row = Math.floor(index / cols)
  return { left: col * (MESA_CARD_W + GAP), top: row * (MESA_CARD_H + GAP) }
}

export default function MeseroFloorPage() {
  const navigate = useNavigate()
  const [moviendo, setMoviendo] = useState(false)
  const [dragId, setDragId] = useState(null)
  const { mesas, mesero } = useMesas({ ignorarFiltro: moviendo })
  const soloMisMesas = useMeseroStore((s) => s.soloMisMesas)
  const toggleSoloMisMesas = useMeseroStore((s) => s.toggleSoloMisMesas)
  const { posiciones, setPosicion } = useMesaLayout()

  const containerRef = useRef(null)
  const dragRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const medir = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rangoX = Math.max(size.width - MESA_CARD_W, 0)
  const rangoY = Math.max(size.height - MESA_CARD_H, 0)

  function posicionPx(mesa, index) {
    const frac = posiciones[mesa.id]
    if (frac) return { left: frac.x * rangoX, top: frac.y * rangoY }
    return posicionPorDefecto(index, size.width)
  }

  function handlePointerDown(e, mesa, pos) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      mesaId: mesa.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLeft: pos.left,
      startTop: pos.top,
      left: pos.left,
      top: pos.top,
    }
    setDragId(mesa.id)
  }

  // Sigue el dedo/cursor 1:1 mutando el estilo directamente (sin pasar por
  // React) para que el arrastre se sienta fluido incluso con muchas mesas.
  function handlePointerMove(e) {
    const d = dragRef.current
    if (!d) return
    const left = Math.min(Math.max(0, d.startLeft + (e.clientX - d.startClientX)), rangoX)
    const top = Math.min(Math.max(0, d.startTop + (e.clientY - d.startClientY)), rangoY)
    d.left = left
    d.top = top
    e.currentTarget.style.left = `${left}px`
    e.currentTarget.style.top = `${top}px`
  }

  function handlePointerUp() {
    const d = dragRef.current
    if (!d) return
    setPosicion(d.mesaId, rangoX > 0 ? d.left / rangoX : 0.5, rangoY > 0 ? d.top / rangoY : 0.5)
    dragRef.current = null
    setDragId(null)
  }

  return (
    <div className="h-full flex flex-col" style={{ padding: '24px 32px' }}>
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--jb-ink)' }}>Mesas</h1>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--jb-ink-soft)' }}>
            {moviendo
              ? 'Arrastra cada mesa a donde quieras acomodarla en el mapa'
              : mesero ? `Atendiendo como ${mesero.nombre}` : ''}
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 12 }}>
          {!moviendo && (
            <button
              onClick={toggleSoloMisMesas}
              style={{
                fontFamily: "'Inter Tight', sans-serif", fontSize: 16, fontWeight: 800,
                padding: '14px 22px', borderRadius: 16, cursor: 'pointer',
                border: soloMisMesas ? '2.5px solid var(--jb-pink)' : '2.5px solid var(--jb-line)',
                background: soloMisMesas ? 'var(--jb-pink)' : '#fff',
                color: soloMisMesas ? '#fff' : 'var(--jb-ink)',
              }}
            >
              {soloMisMesas ? '✓ Mostrando solo mis mesas' : 'Mostrar solo mis mesas'}
            </button>
          )}
          <button
            onClick={() => setMoviendo((v) => !v)}
            style={{
              fontFamily: "'Inter Tight', sans-serif", fontSize: 16, fontWeight: 800,
              padding: '14px 22px', borderRadius: 16, cursor: 'pointer',
              border: moviendo ? '2.5px solid var(--jb-pink)' : '2.5px solid var(--jb-line)',
              background: moviendo ? 'var(--jb-pink)' : '#fff',
              color: moviendo ? '#fff' : 'var(--jb-ink)',
            }}
          >
            {moviendo ? '✓ Listo' : '⠿ Mover mesas'}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          borderRadius: 20,
          border: moviendo ? '2.5px dashed var(--jb-line)' : 'none',
          background: moviendo
            ? 'radial-gradient(var(--jb-line) 1.5px, transparent 1.5px) 0 0 / 26px 26px'
            : 'none',
          transition: 'background 0.15s ease, border 0.15s ease',
        }}
      >
        {mesas.map((mesa, i) => {
          const pos = posicionPx(mesa, i)
          const arrastrando = dragId === mesa.id
          return (
            <div
              key={mesa.id}
              data-mesa-id={mesa.id}
              onPointerDown={moviendo ? (e) => handlePointerDown(e, mesa, pos) : undefined}
              onPointerMove={moviendo ? handlePointerMove : undefined}
              onPointerUp={moviendo ? handlePointerUp : undefined}
              onPointerCancel={moviendo ? handlePointerUp : undefined}
              style={{
                position: 'absolute',
                left: pos.left,
                top: pos.top,
                width: MESA_CARD_W,
                touchAction: moviendo ? 'none' : undefined,
                userSelect: moviendo ? 'none' : undefined,
                WebkitUserSelect: moviendo ? 'none' : undefined,
                WebkitTouchCallout: moviendo ? 'none' : undefined,
                cursor: moviendo ? 'grab' : undefined,
                zIndex: arrastrando ? 20 : 1,
                filter: arrastrando ? 'drop-shadow(0 14px 26px rgba(51,34,42,0.35))' : 'none',
                transform: arrastrando ? 'scale(1.05)' : 'scale(1)',
                transition: arrastrando ? 'none' : 'transform 0.12s ease',
              }}
            >
              <MesaCard mesa={mesa} onClick={moviendo ? undefined : () => navigate(`/mesero/orden/${mesa.id}`)} />
              {moviendo && (
                <span
                  style={{
                    position: 'absolute', top: -8, right: -8, width: 32, height: 32,
                    borderRadius: '50%', background: 'var(--jb-pink)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 900, boxShadow: '0 2px 8px rgba(51,34,42,0.25)',
                    pointerEvents: 'none',
                  }}
                >
                  ⠿
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
