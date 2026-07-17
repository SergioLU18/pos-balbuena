import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useMeseroStore, usePosStore } from '../../store/appStore'
import AdminMeserosPage from './AdminMeserosPage'
import AdminMenuPage from './AdminMenuPage'

// Panel de administración. Solo accesible para un mesero esAdmin que ya confirmó su
// PIN (adminUnlocked, ver AdminEntry). El gate es client-side — misma postura
// "atribución, no seguridad" del resto del POS. Un deep-link a /admin sin cumplir
// ambas condiciones redirige a /mesero.
export default function AdminApp() {
  const navigate = useNavigate()
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const unlocked = useMeseroStore((s) => s.adminUnlocked)
  const setAdminUnlocked = useMeseroStore((s) => s.setAdminUnlocked)
  const meseros = usePosStore((s) => s.meseros)
  const mesero = meseros.find((m) => m.id === currentMeseroId) ?? null

  if (!mesero?.esAdmin || !unlocked) return <Navigate to="/mesero" replace />

  function salir() {
    setAdminUnlocked(false)
    navigate('/mesero')
  }

  return (
    <div
      className="h-dvh w-full flex flex-col"
      style={{ background: 'var(--jb-cream)', fontFamily: "'Inter Tight', sans-serif" }}
    >
      <header
        className="flex items-center justify-between flex-shrink-0"
        style={{ padding: '12px 24px', background: 'var(--jb-pink)', boxShadow: '0 2px 12px var(--jb-shadow)' }}
      >
        <div className="flex items-center" style={{ gap: 18 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>Administración</span>
          <nav className="flex items-center" style={{ gap: 8 }}>
            <TabLink to="/admin" end>Meseros</TabLink>
            <TabLink to="/admin/menu">Menú</TabLink>
          </nav>
        </div>
        <div className="flex items-center" style={{ gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{mesero.nombre}</span>
          <button
            onClick={salir}
            style={{
              fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 15,
              padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.92)', color: 'var(--jb-pink-dark)',
            }}
          >
            ← Salir
          </button>
        </div>
      </header>
      <main className="flex-1 min-h-0" style={{ overflowY: 'auto' }}>
        <Routes>
          <Route index element={<AdminMeserosPage />} />
          <Route path="menu" element={<AdminMenuPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
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
        padding: '9px 16px', borderRadius: 11, textDecoration: 'none',
        background: isActive ? '#fff' : 'rgba(255,255,255,0.18)',
        color: isActive ? 'var(--jb-pink-dark)' : '#fff',
      })}
    >
      {children}
    </NavLink>
  )
}
