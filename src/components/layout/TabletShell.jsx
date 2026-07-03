import { JbFlor } from '../ui/JbFlor'
import { MESEROS } from '../../lib/mockMeseros'
import { useMeseroStore } from '../../store/appStore'

/** Contenedor pensado para iPad en horizontal: header de marca + selector de mesero + contenido. */
export function TabletShell({ children }) {
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const setMesero = useMeseroStore((s) => s.setMesero)

  return (
    <div
      className="h-dvh w-full flex flex-col"
      style={{ background: 'var(--jb-cream)', fontFamily: "'Inter Tight', sans-serif" }}
    >
      <header
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: '14px 28px',
          background: 'var(--jb-pink)',
          boxShadow: '0 2px 12px var(--jb-shadow)',
        }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <JbFlor size={34} />
          <span className="jb-script" style={{ fontSize: 30, color: '#fff', lineHeight: 1 }}>
            Jardín Balbuena
          </span>
        </div>
        <select
          value={currentMeseroId}
          onChange={(e) => setMesero(e.target.value)}
          style={{
            fontFamily: "'Inter Tight', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            padding: '10px 16px',
            borderRadius: 12,
            border: 'none',
            background: 'rgba(255,255,255,0.92)',
            color: 'var(--jb-pink-dark)',
          }}
        >
          {MESEROS.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  )
}
