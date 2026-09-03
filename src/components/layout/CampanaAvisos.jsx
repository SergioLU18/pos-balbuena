import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAvisosStore } from '../../store/appStore'
import { minutosTranscurridos } from '../../lib/utils'

// Campana de avisos del header. Existe porque el sonido por sí solo no basta: dice
// "algo pasó" pero no QUÉ ni en qué mesa, y si el mesero estaba al otro lado del salón
// puede que ni lo haya oído. Aquí queda el registro del turno, con el número de mesa,
// hace cuánto fue, y un toque para ir directo a esa orden.
const TEMA = {
  listo: { icono: '🔔', color: 'var(--jb-teal)', fondo: 'var(--jb-teal-bg)' },
  error: { icono: '⚠️', color: '#C24A4A', fondo: '#FCE4E4' },
}

export function CampanaAvisos() {
  const navigate = useNavigate()
  const avisos = useAvisosStore((s) => s.avisos)
  const marcarTodosLeidos = useAvisosStore((s) => s.marcarTodosLeidos)
  const limpiarAvisos = useAvisosStore((s) => s.limpiarAvisos)
  const [open, setOpen] = useState(false)

  const sinLeer = avisos.filter((a) => !a.leido).length

  // Abrir el panel ES haberlos visto: el badge se apaga aquí, no al tocar cada renglón.
  function abrir() {
    setOpen(true)
    marcarTodosLeidos()
  }

  function irAlAviso(aviso) {
    setOpen(false)
    if (aviso.mesaId) navigate(`/mesero/orden/${aviso.mesaId}`)
  }

  return (
    <>
      <button
        onClick={abrir}
        aria-label={sinLeer > 0 ? `Avisos (${sinLeer} sin leer)` : 'Avisos'}
        style={{
          position: 'relative', width: 44, height: 44, borderRadius: 12, border: 'none',
          cursor: 'pointer', background: 'rgba(255,255,255,0.92)', color: 'var(--jb-pink-dark)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {sinLeer > 0 && (
          // key={sinLeer}: al cambiar la cuenta el badge se remonta y vuelve a hacer
          // "pop", que es lo que jala el ojo justo cuando entra un aviso nuevo. Un
          // parpadeo continuo (jb-pulse) sería ilegible y cansado durante todo el turno.
          <span
            key={sinLeer}
            className="jb-pop"
            style={{
              position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10,
              background: 'var(--jb-pink-dark)', color: '#fff', fontSize: 12, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
              border: '2px solid #fff',
            }}
          >
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
            zIndex: 1000, padding: '92px 24px 24px',
          }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 22, width: 420, maxWidth: '100%',
              maxHeight: '100%', display: 'flex', flexDirection: 'column',
              fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
            }}
          >
            <div className="flex items-center justify-between" style={{ padding: '20px 22px 12px' }}>
              <h2 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: 'var(--jb-ink)' }}>Avisos</h2>
              <button
                onClick={() => setOpen(false)}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 20, fontWeight: 800, color: 'var(--jb-gray)', lineHeight: 1, padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '0 22px', flex: 1, minHeight: 0 }}>
              {avisos.length === 0 && (
                <p style={{ margin: '8px 0 24px', fontSize: 15, color: 'var(--jb-ink-soft)' }}>
                  Sin avisos por ahora. Aquí van a aparecer los pedidos que cocina deje listos
                  y cualquier cosa que no se haya podido guardar.
                </p>
              )}

              {avisos.map((a) => {
                const tema = TEMA[a.tipo] ?? TEMA.listo
                return (
                  <button
                    key={a.id}
                    onClick={() => irAlAviso(a)}
                    style={{
                      width: '100%', textAlign: 'left', cursor: a.mesaId ? 'pointer' : 'default',
                      fontFamily: "'Inter Tight', sans-serif",
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 14px', marginBottom: 10, borderRadius: 16,
                      border: `2px solid ${tema.color}`, background: tema.fondo,
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>{tema.icono}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: 'var(--jb-ink)' }}>
                        {a.titulo}
                      </span>
                      {a.detalle && (
                        <span style={{ display: 'block', marginTop: 2, fontSize: 14, color: 'var(--jb-ink-soft)' }}>
                          {a.detalle}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)', flexShrink: 0 }}>
                      {minutosTranscurridos(a.at)}
                    </span>
                  </button>
                )
              })}
            </div>

            {avisos.length > 0 && (
              <div style={{ padding: '12px 22px 20px', borderTop: '2px solid var(--jb-line)' }}>
                <button
                  onClick={limpiarAvisos}
                  style={{
                    fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 800,
                    padding: '12px 18px', borderRadius: 14, cursor: 'pointer', width: '100%',
                    border: '2.5px solid var(--jb-line)', background: '#fff', color: 'var(--jb-ink-soft)',
                  }}
                >
                  Limpiar avisos
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
