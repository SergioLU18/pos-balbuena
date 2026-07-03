import { useNavigate } from 'react-router-dom'
import { useMesas } from '../../hooks/useMesas'
import { useMeseroStore } from '../../store/appStore'
import { MesaCard } from '../../components/mesero/MesaCard'

export default function MeseroFloorPage() {
  const navigate = useNavigate()
  const { mesas, mesero } = useMesas()
  const soloMisMesas = useMeseroStore((s) => s.soloMisMesas)
  const toggleSoloMisMesas = useMeseroStore((s) => s.toggleSoloMisMesas)

  return (
    <div className="h-full flex flex-col" style={{ padding: '24px 32px' }}>
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--jb-ink)' }}>Mesas</h1>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--jb-ink-soft)' }}>
            {mesero ? `Atendiendo como ${mesero.nombre}` : ''}
          </p>
        </div>
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
      </div>

      <div
        className="flex-1 no-scrollbar"
        style={{
          overflowY: 'auto', display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 18, alignContent: 'start',
        }}
      >
        {mesas.map((mesa) => (
          <MesaCard key={mesa.id} mesa={mesa} onClick={() => navigate(`/mesero/orden/${mesa.id}`)} />
        ))}
      </div>
    </div>
  )
}
