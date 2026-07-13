import { JbFlor } from '../ui/JbFlor'
import { MeseroSwitcher } from './MeseroSwitcher'

/** Contenedor pensado para iPad en horizontal: header de marca + selector de mesero + contenido. */
export function TabletShell({ children }) {
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
        <MeseroSwitcher />
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  )
}
