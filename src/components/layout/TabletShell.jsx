import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMeseroStore, usePosStore } from '../../store/appStore'
import { useMesaAdmin } from '../../hooks/useMesaAdmin'
import { siguienteNumeroParaLlevar } from '../../lib/utils'
import { MeseroSwitcher } from './MeseroSwitcher'

/** Botón del header: crea una mesa virtual "PL-N" (mismo flujo de comanda/cuenta/cocina
 *  que una mesa real, ver lib/utils.js) y salta directo a armar su orden — sin pasar por
 *  el modal de "Agregar mesa", que pide un número que aquí no aplica. */
function BotonParaLlevar() {
  const navigate = useNavigate()
  const mesas = usePosStore((s) => s.mesas)
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const { crearMesa } = useMesaAdmin()
  const [creando, setCreando] = useState(false)

  async function handleClick() {
    if (creando) return
    setCreando(true)
    const numero = siguienteNumeroParaLlevar(mesas)
    const { error, id } = await crearMesa(numero, currentMeseroId)
    setCreando(false)
    if (error) { window.alert(error); return }
    navigate(id ? `/mesero/orden/${id}` : '/mesero')
  }

  return (
    <button
      onClick={handleClick}
      disabled={creando}
      style={{
        fontFamily: "'Inter Tight', sans-serif", fontWeight: 700, fontSize: 16,
        padding: '10px 16px', borderRadius: 12, border: 'none', cursor: creando ? 'default' : 'pointer',
        background: 'rgba(255,255,255,0.92)', color: 'var(--jb-pink-dark)', opacity: creando ? 0.7 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}
    >
      {creando ? 'Creando…' : '+ Pedido para Llevar'}
    </button>
  )
}

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
        <img src="/brand/logo-jardin-balbuena.webp" alt="Jardín Balbuena" style={{ height: 58, width: 'auto' }} />
        <div className="flex items-center" style={{ gap: 12 }}>
          <BotonParaLlevar />
          <MeseroSwitcher />
        </div>
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  )
}
