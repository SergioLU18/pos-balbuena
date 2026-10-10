import { useState } from 'react'
import { useMeseroStore, usePosStore } from '../../store/appStore'
import { PinPad } from './PinPad'

// Autorización de un administrador para algo que un mesero no puede hacer solo — hoy,
// cancelar comida que ya se mandó a cocina. La da el admin que esté en el piso: se
// acerca a la tablet del mesero y teclea SU PIN, así que no importa quién tenga la
// sesión abierta. Si hay un solo admin se va directo a su PIN; si hay varios, primero
// se elige quién autoriza (y si el mesero activo es admin, ya viene elegido).
// Mismo criterio que AdminEntry: un admin sin PIN configurado autoriza directo. Y como
// todo PIN aquí, es atribución, no seguridad (ver PinPad); el servidor vuelve a
// comprobar que quien autoriza sea admin (pos_admin_autoriza).
export function AutorizarAdminModal({ titulo, onAutorizado, onClose }) {
  const meseros = usePosStore((s) => s.meseros)
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const admins = meseros.filter((m) => m.esAdmin && m.activo !== false)

  const [elegido, setElegido] = useState(() => {
    const preferido = admins.length === 1 ? admins[0] : admins.find((a) => a.id === currentMeseroId)
    return preferido?.pin ? preferido : null
  })
  const [entered, setEntered] = useState('')
  const [error, setError] = useState(false)

  function elegir(admin) {
    if (!admin.pin) { onAutorizado(admin); return }
    setElegido(admin)
    setEntered('')
    setError(false)
  }

  function teclear(d) {
    if (entered.length >= 4) return
    const next = entered + d
    setEntered(next)
    setError(false)
    if (next.length === 4) {
      if (next === elegido.pin) onAutorizado(elegido)
      else { setError(true); setEntered('') }
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20,
      }}
    >
      <div
        className="jb-pop"
        style={{
          background: '#fff', borderRadius: 26, width: 420, maxWidth: '100%',
          fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
          padding: '28px 28px 32px', boxSizing: 'border-box',
          maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto',
        }}
      >
        {elegido ? (
          <PinPad
            titulo={titulo}
            subtitulo={`Autoriza ${elegido.nombre} con su PIN`}
            entered={entered}
            error={error}
            onDigit={teclear}
            onBack={() => { setEntered((e) => e.slice(0, -1)); setError(false) }}
            // Con varios admins, "Cancelar" regresa a la lista por si se eligió al que no está.
            onCancel={admins.length > 1 ? () => setElegido(null) : onClose}
          />
        ) : (
          <>
            <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>{titulo}</h2>
            <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--jb-ink-soft)' }}>
              {admins.length > 0
                ? 'Lo tiene que autorizar un administrador. ¿Quién autoriza?'
                : 'Lo tiene que autorizar un administrador, y no hay ninguno dado de alta.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {admins.map((a) => (
                <button
                  key={a.id}
                  onClick={() => elegir(a)}
                  style={{
                    fontFamily: "'Inter Tight', sans-serif", fontSize: 17, fontWeight: 800,
                    padding: '14px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                    border: '2.5px solid var(--jb-line)', background: '#fff', color: 'var(--jb-ink)',
                  }}
                >
                  {a.nombre}
                </button>
              ))}
              <button
                onClick={onClose}
                style={{
                  fontFamily: "'Inter Tight', sans-serif", fontSize: 16, fontWeight: 700,
                  padding: '14px 16px', borderRadius: 14, cursor: 'pointer', marginTop: 4,
                  border: '2.5px solid var(--jb-line)', background: 'var(--jb-cream)', color: 'var(--jb-ink)',
                }}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
