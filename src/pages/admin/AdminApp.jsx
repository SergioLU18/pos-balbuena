import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useMeseroStore, usePosStore } from '../../store/appStore'
import { PinPad } from '../../components/layout/PinPad'
import AdminMeserosPage from './AdminMeserosPage'
import AdminMenuPage from './AdminMenuPage'
import AdminMesasPage from './AdminMesasPage'
import AdminBitacoraPage from './AdminBitacoraPage'
import AdminClientesPage from './AdminClientesPage'
import AdminImpresoraPage from './AdminImpresoraPage'

// Panel de administración. Solo accesible para un mesero esAdmin. El gate es client-side
// — misma postura "atribución, no seguridad" del resto del POS. Si el mesero actual no es
// admin, redirige a /mesero. Si sí es admin pero adminUnlocked está en false (no se
// persiste a propósito: cada refresh/bloqueo vuelve a pedir el PIN), el PIN se pide AQUÍ
// MISMO, sin navegar — así un refresh en "/admin/mesas" se queda en "/admin/mesas" tras
// desbloquear, en vez de rebotar a /mesero y perder la pestaña en la que se estaba.
export default function AdminApp() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const unlocked = useMeseroStore((s) => s.adminUnlocked)
  const setAdminUnlocked = useMeseroStore((s) => s.setAdminUnlocked)
  const setLastAdminPath = useMeseroStore((s) => s.setLastAdminPath)
  const meseros = usePosStore((s) => s.meseros)
  const mesero = meseros.find((m) => m.id === currentMeseroId) ?? null

  const [entered, setEntered] = useState('')
  const [error, setError] = useState(false)

  // Recuerda la pestaña actual (p. ej. "/admin/mesas") mientras el admin navega, para que
  // AdminEntry pueda volver ahí tras el PIN (cuando se entra desde el botón "Ajustes" en
  // /mesero) en vez de caer siempre en "/admin/menu".
  useEffect(() => {
    if (mesero?.esAdmin && unlocked && location.pathname !== '/admin') {
      setLastAdminPath(location.pathname)
    }
  }, [location.pathname, mesero?.esAdmin, unlocked, setLastAdminPath])

  // Mesero sin PIN configurado: no hay nada que pedir, se desbloquea solo (mismo criterio
  // que AdminEntry/MeseroGate para meseros sin PIN).
  useEffect(() => {
    if (mesero?.esAdmin && !unlocked && !mesero.pin) setAdminUnlocked(true)
  }, [mesero?.esAdmin, mesero?.pin, unlocked, setAdminUnlocked])

  if (!mesero?.esAdmin) return <Navigate to="/mesero" replace />

  function salir() {
    setAdminUnlocked(false)
    navigate('/mesero')
  }

  if (!unlocked) {
    if (!mesero.pin) return null // el useEffect de arriba ya está desbloqueando

    function teclear(d) {
      if (entered.length >= 4) return
      const next = entered + d
      setEntered(next)
      setError(false)
      if (next.length === 4) {
        if (next === mesero.pin) setAdminUnlocked(true)
        else { setError(true); setEntered('') }
      }
    }

    function borrar() {
      setEntered((e) => e.slice(0, -1))
      setError(false)
    }

    return (
      <div
        className="h-pantalla w-full flex flex-col items-center justify-center"
        style={{ background: 'var(--jb-cream)', fontFamily: "'Inter Tight', sans-serif", padding: 20, overflowY: 'auto' }}
      >
        <div
          style={{
            background: '#fff', borderRadius: 26, width: 420, maxWidth: '100%',
            boxShadow: '0 24px 60px rgba(51,34,42,0.3)', padding: '28px 28px 32px',
            boxSizing: 'border-box', maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto', flexShrink: 0,
          }}
        >
          <PinPad
            titulo="Ajustes"
            subtitulo={`PIN de ${mesero.nombre}`}
            entered={entered}
            error={error}
            onDigit={teclear}
            onBack={borrar}
            onCancel={() => navigate('/mesero')}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-pantalla w-full flex flex-col"
      style={{ background: 'var(--jb-cream)', fontFamily: "'Inter Tight', sans-serif" }}
    >
      <header
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: '12px 24px', paddingTop: 'calc(12px + var(--jb-safe-top))', background: 'var(--jb-pink)', boxShadow: '0 2px 12px var(--jb-shadow)',
          flexWrap: 'wrap', rowGap: 10, columnGap: 16,
        }}
      >
        <div className="flex items-center" style={{ gap: 14, flexWrap: 'wrap', rowGap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', flexShrink: 0 }}>Ajustes</span>
          <nav className="flex items-center" style={{ gap: 8, flexWrap: 'wrap', rowGap: 8 }}>
            <TabLink to="/admin/menu">Menú</TabLink>
            <TabLink to="/admin/mesas">Mesas</TabLink>
            <TabLink to="/admin/meseros">Meseros</TabLink>
            <TabLink to="/admin/bitacora">Bitácora</TabLink>
            <TabLink to="/admin/clientes">Clientes</TabLink>
            <TabLink to="/admin/impresora">Impresora</TabLink>
          </nav>
        </div>
        <div className="flex items-center" style={{ gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>{mesero.nombre}</span>
          <button
            onClick={salir}
            style={{
              fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 15,
              padding: '12px 18px', minHeight: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.92)', color: 'var(--jb-pink-dark)', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            ← Salir
          </button>
        </div>
      </header>
      <main className="flex-1 min-h-0" style={{ overflowY: 'auto' }}>
        <Routes>
          <Route index element={<Navigate to="/admin/menu" replace />} />
          <Route path="menu" element={<AdminMenuPage />} />
          <Route path="mesas" element={<AdminMesasPage />} />
          <Route path="meseros" element={<AdminMeserosPage />} />
          <Route path="bitacora" element={<AdminBitacoraPage />} />
          <Route path="clientes" element={<AdminClientesPage />} />
          <Route path="impresora" element={<AdminImpresoraPage />} />
          <Route path="*" element={<Navigate to="/admin/menu" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function TabLink({ to, end, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 15,
        padding: '0 18px', height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 11, textDecoration: 'none', textAlign: 'center', whiteSpace: 'nowrap', flexShrink: 0,
        background: isActive ? '#fff' : 'rgba(255,255,255,0.18)',
        color: isActive ? 'var(--jb-pink-dark)' : '#fff',
      })}
    >
      {children}
    </NavLink>
  )
}
