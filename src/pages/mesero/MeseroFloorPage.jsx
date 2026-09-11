import { useNavigate } from 'react-router-dom'
import { useMesas } from '../../hooks/useMesas'
import { useLlevarStore, useMeseroStore } from '../../store/appStore'
import { MesaCard, MESA_CARD_W } from '../../components/mesero/MesaCard'

export default function MeseroFloorPage() {
  const navigate = useNavigate()
  const { mesas, mesero } = useMesas()
  const soloMisMesas = useMeseroStore((s) => s.soloMisMesas)
  const toggleSoloMisMesas = useMeseroStore((s) => s.toggleSoloMisMesas)
  // Cuántas atiende el mesero actual. Se cuenta por esMia y no por el largo de `mesas`,
  // que con el filtro apagado trae todo el salón.
  const misMesas = mesas.filter((m) => m.esMia).length
  // Las órdenes para llevar no tienen mesa que pintar en este listado, así que aquí solo
  // va la cuenta: el badge es lo que evita que una orden de mostrador se quede olvidada
  // porque nada en esta pantalla la menciona.
  const llevarAbiertas = useLlevarStore((s) => s.ordenes).filter((o) => o.estado === 'abierta').length

  return (
    <div className="h-full flex flex-col" style={{ padding: '24px 32px' }}>
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 20, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--jb-ink)' }}>Mesas</h1>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--jb-ink-soft)' }}>
            {mesero ? `Atendiendo como ${mesero.nombre} · ${misMesas} ${misMesas === 1 ? 'mesa' : 'mesas'}` : ''}
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 12 }}>
          <button
            onClick={() => navigate('/mesero/llevar')}
            style={{
              position: 'relative',
              fontFamily: "'Inter Tight', sans-serif", fontSize: 16, fontWeight: 800,
              padding: '14px 20px', borderRadius: 16, cursor: 'pointer', whiteSpace: 'nowrap',
              border: '2.5px solid var(--jb-pink-light)', background: 'var(--jb-pink-tint)',
              color: 'var(--jb-pink-dark)',
            }}
          >
            🥡 Para llevar
            {llevarAbiertas > 0 && (
              <span
                style={{
                  position: 'absolute', top: -8, right: -8, minWidth: 24, height: 24, borderRadius: 12,
                  background: 'var(--jb-pink)', color: '#fff', fontSize: 13, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
                }}
              >
                {llevarAbiertas}
              </span>
            )}
          </button>
          <button
            onClick={toggleSoloMisMesas}
            style={{
              fontFamily: "'Inter Tight', sans-serif", fontSize: 16, fontWeight: 800,
              padding: '14px 20px', borderRadius: 16, cursor: 'pointer', whiteSpace: 'nowrap',
              border: `2.5px solid ${soloMisMesas ? 'var(--jb-pink)' : 'var(--jb-line)'}`,
              background: soloMisMesas ? 'var(--jb-pink)' : '#fff',
              color: soloMisMesas ? '#fff' : 'var(--jb-ink)',
            }}
          >
            {soloMisMesas ? '✓ Solo mis mesas' : 'Solo mis mesas'}
          </button>
        </div>
      </div>

      {mesas.length === 0 ? (
        <p style={{ fontSize: 15, color: 'var(--jb-gray)' }}>
          {soloMisMesas ? 'No tienes mesas asignadas.' : 'Todavía no hay mesas. Un administrador las crea en Ajustes → Mesas.'}
        </p>
      ) : (
        <div
          className="flex-1 min-h-0 no-scrollbar"
          style={{
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${MESA_CARD_W}px, 1fr))`,
            gap: 18,
            alignContent: 'start',
          }}
        >
          {mesas.map((mesa) => (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              meseroActualId={mesero?.id}
              onClick={() => navigate(`/mesero/orden/${mesa.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
