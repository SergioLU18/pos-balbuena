import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMesas } from '../../hooks/useMesas'
import { useMesaLayout } from '../../hooks/useMesaLayout'
import { useMesaAdmin } from '../../hooks/useMesaAdmin'
import { useMeseroStore } from '../../store/appStore'
import { etiquetaMesa, esParaLlevar } from '../../lib/utils'
import { MesaCard, MESA_CARD_W, MESA_CARD_H } from '../../components/mesero/MesaCard'
import { CrearMesaModal } from '../../components/mesero/CrearMesaModal'
import { RenombrarMesaModal } from '../../components/mesero/RenombrarMesaModal'

const GAP = 18

/** Botón de la barra superior del mapa (mismo look para todos). */
function BotonBarra({ active, danger, onClick, children }) {
  const color = danger ? '#C24A4A' : 'var(--jb-pink)'
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'Inter Tight', sans-serif", fontSize: 16, fontWeight: 800,
        padding: '14px 20px', borderRadius: 16, cursor: 'pointer', whiteSpace: 'nowrap',
        border: `2.5px solid ${active ? color : 'var(--jb-line)'}`,
        background: active ? color : '#fff',
        color: active ? '#fff' : (danger ? '#C24A4A' : 'var(--jb-ink)'),
      }}
    >
      {children}
    </button>
  )
}

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
  // Dentro del modo mover: sub-modo activo para tocar una mesa y renombrarla o
  // borrarla. null = arrastrar para acomodar. Solo aplica para un admin.
  const [subModo, setSubModo] = useState(null) // null | 'nombre' | 'borrar'
  const [dragId, setDragId] = useState(null)
  const { mesas, mesero, meseros } = useMesas({ ignorarFiltro: moviendo })
  // Agregar, renombrar y quitar mesas es exclusivo de un mesero administrador.
  // Mover/acomodar el mapa lo puede hacer cualquiera (es solo layout local).
  const esAdmin = !!mesero?.esAdmin
  const soloMisMesas = useMeseroStore((s) => s.soloMisMesas)
  const toggleSoloMisMesas = useMeseroStore((s) => s.toggleSoloMisMesas)
  const { posiciones, setPosicion } = useMesaLayout()
  const { crearMesa, renombrarMesa, borrarMesa } = useMesaAdmin()
  const [creandoMesa, setCreandoMesa] = useState(false)
  const [renombrando, setRenombrando] = useState(null)

  const arrastrable = moviendo && !subModo

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

  function salirDeMover() {
    setMoviendo(false)
    setSubModo(null)
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

  async function handleBorrarMesa(mesa) {
    if (!esAdmin) return
    if (mesa.estado === 'abierta') {
      window.alert(`${etiquetaMesa(mesa.numero)} tiene una cuenta abierta — no se puede borrar.`)
      return
    }
    if (!window.confirm(`¿Borrar ${etiquetaMesa(mesa.numero)}? Esta acción no se puede deshacer.`)) return
    const { error } = await borrarMesa(mesa.id)
    if (error) window.alert(error)
  }

  function handleCardClick(mesa) {
    if (!moviendo) { navigate(`/mesero/orden/${mesa.id}`); return }
    if (subModo === 'nombre') { if (!esParaLlevar(mesa.numero)) setRenombrando(mesa); return }
    if (subModo === 'borrar') { handleBorrarMesa(mesa) }
    // subModo === null → solo se arrastra, el clic no hace nada
  }

  const subtitulo = !moviendo
    ? (mesero ? `Atendiendo como ${mesero.nombre}` : '')
    : subModo === 'nombre'
    ? 'Toca la mesa a la que quieras cambiarle el nombre'
    : subModo === 'borrar'
    ? 'Toca la mesa que quieras borrar'
    : esAdmin
    ? 'Arrastra cada mesa para acomodarla. Usa los botones de arriba para agregar, renombrar o borrar.'
    : 'Arrastra cada mesa para acomodarla. Agregar, renombrar o borrar mesas es solo para administradores.'

  return (
    <div className="h-full flex flex-col" style={{ padding: '24px 32px' }}>
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 20, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--jb-ink)' }}>Mesas</h1>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--jb-ink-soft)' }}>{subtitulo}</p>
        </div>
        <div className="flex items-center" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!moviendo && (
            <BotonBarra active={soloMisMesas} onClick={toggleSoloMisMesas}>
              {soloMisMesas ? '✓ Solo mis mesas' : 'Solo mis mesas'}
            </BotonBarra>
          )}
          {moviendo && esAdmin && (
            <>
              <BotonBarra onClick={() => { setSubModo(null); setCreandoMesa(true) }}>+ Agregar mesa</BotonBarra>
              <BotonBarra active={subModo === 'nombre'} onClick={() => setSubModo((s) => (s === 'nombre' ? null : 'nombre'))}>
                ✎ Cambiar nombre
              </BotonBarra>
              <BotonBarra danger active={subModo === 'borrar'} onClick={() => setSubModo((s) => (s === 'borrar' ? null : 'borrar'))}>
                🗑 Borrar mesa
              </BotonBarra>
            </>
          )}
          <BotonBarra active={moviendo} onClick={() => (moviendo ? salirDeMover() : setMoviendo(true))}>
            {moviendo ? '✓ Listo' : '⠿ Mover mesas'}
          </BotonBarra>
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
          const esPL = esParaLlevar(mesa.numero)
          // En sub-modo, la mesa se resalta como "tocable" (rosa para renombrar,
          // rojo para borrar). Un pedido para llevar no se renombra: se atenúa.
          const bloqueadaEnNombre = subModo === 'nombre' && esPL
          const anillo = subModo && !bloqueadaEnNombre
            ? `0 0 0 3px ${subModo === 'borrar' ? '#C24A4A' : 'var(--jb-pink)'}`
            : 'none'
          return (
            <div
              key={mesa.id}
              data-mesa-id={mesa.id}
              onPointerDown={arrastrable ? (e) => handlePointerDown(e, mesa, pos) : undefined}
              onPointerMove={arrastrable ? handlePointerMove : undefined}
              onPointerUp={arrastrable ? handlePointerUp : undefined}
              onPointerCancel={arrastrable ? handlePointerUp : undefined}
              style={{
                position: 'absolute',
                left: pos.left,
                top: pos.top,
                width: MESA_CARD_W,
                borderRadius: 24,
                boxShadow: anillo,
                opacity: bloqueadaEnNombre ? 0.4 : 1,
                touchAction: arrastrable ? 'none' : undefined,
                userSelect: moviendo ? 'none' : undefined,
                WebkitUserSelect: moviendo ? 'none' : undefined,
                WebkitTouchCallout: moviendo ? 'none' : undefined,
                cursor: arrastrable ? 'grab' : (moviendo && subModo && !bloqueadaEnNombre ? 'pointer' : undefined),
                zIndex: arrastrando ? 20 : 1,
                filter: arrastrando ? 'drop-shadow(0 14px 26px rgba(51,34,42,0.35))' : 'none',
                transform: arrastrando ? 'scale(1.05)' : 'scale(1)',
                transition: arrastrando ? 'none' : 'transform 0.12s ease, box-shadow 0.12s ease',
              }}
            >
              <MesaCard mesa={mesa} onClick={arrastrable ? undefined : () => handleCardClick(mesa)} />
              {arrastrable && (
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

      {creandoMesa && esAdmin && (
        <CrearMesaModal
          meseros={meseros}
          onConfirm={crearMesa}
          onClose={() => setCreandoMesa(false)}
        />
      )}

      {renombrando && esAdmin && (
        <RenombrarMesaModal
          mesa={renombrando}
          onConfirm={(nombre) => renombrarMesa(renombrando.id, nombre)}
          onClose={() => setRenombrando(null)}
        />
      )}
    </div>
  )
}
