import { useState } from 'react'
import { useMeseroStore, usePosStore } from '../../store/appStore'
import { PinPad } from './PinPad'

// Bloqueo de sesión del lado del mesero. La IDENTIDAD del mesero se recuerda entre
// refreshes (persistida), pero `sessionUnlocked` no se persiste: cada carga arranca
// bloqueada y hay que confirmar el PIN para entrar. Es "atribución, no seguridad" —
// evita que alguien mande órdenes bajo el nombre equivocado, no protege dinero.
//
// Mientras está bloqueado se muestra el PIN del mesero recordado; "¿No eres tú?" abre
// la lista para cambiar. Un PIN correcto (o un mesero sin PIN configurado) desbloquea.
export function MeseroGate({ children }) {
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const sessionUnlocked = useMeseroStore((s) => s.sessionUnlocked)
  const setMesero = useMeseroStore((s) => s.setMesero)
  const setSessionUnlocked = useMeseroStore((s) => s.setSessionUnlocked)
  const meseros = usePosStore((s) => s.meseros)

  const actual = meseros.find((m) => m.id === currentMeseroId) ?? null

  const [target, setTarget] = useState(null) // mesero elegido para el PIN (null = el actual)
  const [eligiendo, setEligiendo] = useState(false) // mostrando la lista para cambiar
  const [entered, setEntered] = useState('')
  const [error, setError] = useState(false)

  // Ya desbloqueado en esta sesión → app normal.
  if (sessionUnlocked) return children
  // Meseros aún no cargados (backend cargando) o mesero sin PIN configurado (base sin
  // sembrar) → no bloquear, para no dejar la app inaccesible.
  if (!actual || !actual.pin) return children

  const quien = target ?? actual

  function desbloquear(id) {
    if (id !== currentMeseroId) setMesero(id)
    setSessionUnlocked(true) // set separado: queda true aunque setMesero lo haya bajado
  }

  function elegir(m) {
    if (!m.pin) { desbloquear(m.id); return } // sin PIN configurado: entra directo
    setTarget(m)
    setEligiendo(false)
    setEntered('')
    setError(false)
  }

  function teclear(d) {
    if (entered.length >= 4) return
    const next = entered + d
    setEntered(next)
    setError(false)
    if (next.length === 4) {
      if (next === quien.pin) {
        desbloquear(quien.id)
      } else {
        setError(true)
        setEntered('')
      }
    }
  }

  function borrar() {
    setEntered((e) => e.slice(0, -1))
    setError(false)
  }

  return (
    <div
      className="h-dvh w-full flex flex-col items-center justify-center"
      style={{ background: 'var(--jb-cream)', fontFamily: "'Inter Tight', sans-serif", padding: 20 }}
    >
      <img
        src="/brand/logo-jardin-balbuena.webp"
        alt="Jardín Balbuena"
        style={{ height: 64, width: 'auto', marginBottom: 24 }}
      />
      <div
        style={{
          background: '#fff', borderRadius: 26, width: 420, maxWidth: '100%',
          boxShadow: '0 24px 60px rgba(51,34,42,0.3)', padding: '28px 28px 32px',
        }}
      >
        {eligiendo ? (
          <>
            <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>
              ¿Quién atiende?
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--jb-ink-soft)' }}>
              Elige tu nombre y confirma con tu PIN
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {meseros.map((m) => (
                <button
                  key={m.id}
                  onClick={() => elegir(m)}
                  style={{
                    fontFamily: "'Inter Tight', sans-serif", fontSize: 19, fontWeight: 800,
                    textAlign: 'left', padding: '16px 20px', borderRadius: 16, cursor: 'pointer',
                    border: '2.5px solid var(--jb-line)', background: '#fff', color: 'var(--jb-ink)',
                  }}
                >
                  {m.nombre}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <PinPad
              titulo={`Hola, ${quien.nombre}`}
              subtitulo="Ingresa tu PIN para entrar"
              entered={entered}
              error={error}
              onDigit={teclear}
              onBack={borrar}
              onCancel={() => { setEligiendo(true); setTarget(null); setEntered(''); setError(false) }}
            />
            <button
              onClick={() => { setEligiendo(true); setTarget(null); setEntered(''); setError(false) }}
              style={{
                marginTop: 18, width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 700,
                color: 'var(--jb-ink-soft)', textDecoration: 'underline',
              }}
            >
              ¿No eres tú? Cambiar de mesero
            </button>
          </>
        )}
      </div>
    </div>
  )
}
