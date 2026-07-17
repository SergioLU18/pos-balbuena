import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMeseroStore, usePosStore } from '../../store/appStore'
import { PinPad } from './PinPad'

// Botón de entrada al panel de admin en el header. Solo aparece si el mesero actual
// es administrador (esAdmin). Al tocarlo re-confirma su propio PIN de 4 dígitos y
// desbloquea /admin (adminUnlocked). Mismo criterio que MeseroSwitcher: si el mesero
// no tiene PIN configurado, entra directo.
export function AdminEntry() {
  const navigate = useNavigate()
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const setAdminUnlocked = useMeseroStore((s) => s.setAdminUnlocked)
  const meseros = usePosStore((s) => s.meseros)
  const mesero = meseros.find((m) => m.id === currentMeseroId) ?? null

  const [open, setOpen] = useState(false)
  const [entered, setEntered] = useState('')
  const [error, setError] = useState(false)

  if (!mesero?.esAdmin) return null

  function entrar() {
    setAdminUnlocked(true)
    setOpen(false)
    navigate('/admin')
  }

  function abrir() {
    if (!mesero.pin) { entrar(); return }
    setEntered('')
    setError(false)
    setOpen(true)
  }

  function teclear(d) {
    if (entered.length >= 4) return
    const next = entered + d
    setEntered(next)
    setError(false)
    if (next.length === 4) {
      if (next === mesero.pin) entrar()
      else { setError(true); setEntered('') }
    }
  }

  function borrar() {
    setEntered((e) => e.slice(0, -1))
    setError(false)
  }

  return (
    <>
      <button
        onClick={abrir}
        title="Panel de administración"
        style={{
          fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 15,
          padding: '10px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.22)', color: '#fff',
          display: 'inline-flex', alignItems: 'center', gap: 7,
        }}
      >
        <span style={{ fontSize: 17 }}>⚙</span> Admin
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 26, width: 420, maxWidth: '100%',
              fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
              padding: '28px 28px 32px',
            }}
          >
            <PinPad
              titulo="Panel de administración"
              subtitulo={`PIN de ${mesero.nombre}`}
              entered={entered}
              error={error}
              onDigit={teclear}
              onBack={borrar}
              onCancel={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
