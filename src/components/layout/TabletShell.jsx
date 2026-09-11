import { useEffect } from 'react'
import { MeseroSwitcher } from './MeseroSwitcher'
import { AdminEntry } from './AdminEntry'
import { CampanaAvisos } from './CampanaAvisos'
import { desbloquearAudio } from '../../lib/sonidos'
import { useAvisoListo } from '../../hooks/useAvisoListo'
import { useVertical } from '../../hooks/useVertical'

/** Contenedor pensado para iPad en horizontal (con un header más compacto en vertical):
 *  header de marca + selector de mesero + contenido. */
export function TabletShell({ children }) {
  const vertical = useVertical()

  // Aviso sonoro de "pedido listo". Va aquí, y no en MeseroApp ni en el mapa de mesas,
  // por dos razones: MeseroApp envuelve a MeseroGate, así que allá arriba el aviso
  // sonaba con el teclado del PIN en pantalla (donde el mesero no puede hacer nada al
  // respecto); y este shell sigue montado en las dos rutas del mesero, así que el aviso
  // llega igual desde el mapa o desde la orden de otra mesa.
  useAvisoListo()

  // Red de seguridad para armar el audio cuando el gate del PIN no llegó a aparecer
  // (mesero sin PIN configurado). Este componente solo se monta DESPUÉS del gate, así
  // que el "primer toque" nunca cae sobre el teclado del PIN — que es justo donde
  // encender la salida de audio se oye como un clic.
  useEffect(() => {
    const armar = () => desbloquearAudio()
    window.addEventListener('pointerdown', armar, { once: true })
    return () => window.removeEventListener('pointerdown', armar)
  }, [])

  return (
    <div
      className="h-dvh w-full flex flex-col"
      style={{ background: 'var(--jb-cream)', fontFamily: "'Inter Tight', sans-serif" }}
    >
      <header
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: vertical ? '12px 18px' : '14px 28px',
          gap: 12,
          background: 'var(--jb-pink)',
          boxShadow: '0 2px 12px var(--jb-shadow)',
        }}
      >
        {/* minWidth 0 + ellipsis: si los botones de la derecha no dejan espacio (tablet
            en vertical con Ajustes visible), el lema se recorta en vez de empujarlos
            fuera de la pantalla. */}
        <div className="flex items-center" style={{ gap: vertical ? 10 : 14, minWidth: 0 }}>
          <img src="/brand/logo-jardin-balbuena.webp" alt="Jardín Balbuena" style={{ height: vertical ? 48 : 58, width: 'auto', flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', cursive",
              fontStyle: 'italic', fontSize: vertical ? 18 : 22, fontWeight: 600,
              color: 'rgba(255,255,255,0.95)', whiteSpace: 'nowrap', lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            El restaurante de las niñas
          </span>
        </div>
        <div className="flex items-center flex-shrink-0" style={{ gap: 10 }}>
          <CampanaAvisos />
          <AdminEntry />
          <MeseroSwitcher />
        </div>
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  )
}
