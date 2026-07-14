import { useState } from 'react'
import { useMeseroStore, usePosStore } from '../../store/appStore'

// Cambio de mesero con PIN. Es "atribución, no seguridad": el PIN evita que se mande
// una orden bajo el nombre equivocado por accidente, no protege dinero (los pagos viven
// en otra app). Se pide el PIN en cada cambio a un mesero distinto.
export function MeseroSwitcher() {
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const setMesero = useMeseroStore((s) => s.setMesero)
  const meseros = usePosStore((s) => s.meseros)

  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState(null) // mesero elegido, esperando su PIN
  const [entered, setEntered] = useState('')
  const [error, setError] = useState(false)

  const actual = meseros.find((m) => m.id === currentMeseroId) ?? null

  function abrir() {
    setTarget(null)
    setEntered('')
    setError(false)
    setOpen(true)
  }

  function cerrar() {
    setOpen(false)
  }

  function elegirMesero(m) {
    if (m.id === currentMeseroId) { cerrar(); return }
    // Sin PIN configurado (base sin sembrar): se permite el cambio directo para no bloquear.
    if (!m.pin) { setMesero(m.id); cerrar(); return }
    setTarget(m)
    setEntered('')
    setError(false)
  }

  function teclear(d) {
    if (entered.length >= 4) return
    const next = entered + d
    setEntered(next)
    setError(false)
    if (next.length === 4) {
      if (next === target.pin) {
        setMesero(target.id)
        cerrar()
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
    <>
      <button
        onClick={abrir}
        style={{
          fontFamily: "'Inter Tight', sans-serif", fontWeight: 700, fontSize: 16,
          padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.92)', color: 'var(--jb-pink-dark)',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}
      >
        <span style={{ fontWeight: 900 }}>{actual?.nombre ?? 'Elegir mesero'}</span>
        <span style={{ opacity: 0.6, fontSize: 13 }}>▾</span>
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) cerrar() }}
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
            {!target ? (
              <>
                <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>
                  ¿Quién atiende?
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--jb-ink-soft)' }}>
                  Elige tu nombre y confirma con tu PIN
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {meseros.map((m) => {
                    const esActual = m.id === currentMeseroId
                    return (
                      <button
                        key={m.id}
                        onClick={() => elegirMesero(m)}
                        style={{
                          fontFamily: "'Inter Tight', sans-serif", fontSize: 19, fontWeight: 800,
                          textAlign: 'left', padding: '16px 20px', borderRadius: 16, cursor: 'pointer',
                          border: esActual ? '2.5px solid var(--jb-pink)' : '2.5px solid var(--jb-line)',
                          background: esActual ? 'var(--jb-pink)' : '#fff',
                          color: esActual ? '#fff' : 'var(--jb-ink)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        {m.nombre}
                        {esActual && <span style={{ fontSize: 14, fontWeight: 700 }}>Atendiendo ahora</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <PinPad
                mesero={target}
                entered={entered}
                error={error}
                onDigit={teclear}
                onBack={borrar}
                onCancel={() => { setTarget(null); setError(false) }}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

function PinPad({ mesero, entered, error, onDigit, onBack, onCancel }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'cancel', '0', 'back']
  return (
    <>
      <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>
        PIN de {mesero.nombre}
      </h2>
      <p style={{ margin: '0 0 18px', fontSize: 15, color: error ? 'var(--jb-pink-dark)' : 'var(--jb-ink-soft)' }}>
        {error ? 'PIN incorrecto, inténtalo de nuevo' : 'Ingresa tus 4 dígitos'}
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, margin: '0 0 24px' }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 18, height: 18, borderRadius: '50%',
              background: i < entered.length ? 'var(--jb-pink)' : 'transparent',
              border: `2.5px solid ${error ? 'var(--jb-pink-dark)' : 'var(--jb-line)'}`,
              transition: 'background 0.1s ease',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {teclas.map((k) => {
          if (k === 'cancel') {
            return (
              <button key={k} onClick={onCancel} style={teclaStyle('accion')}>Cancelar</button>
            )
          }
          if (k === 'back') {
            return (
              <button key={k} onClick={onBack} style={teclaStyle('accion')}>⌫</button>
            )
          }
          return (
            <button key={k} onClick={() => onDigit(k)} style={teclaStyle('digito')}>{k}</button>
          )
        })}
      </div>
    </>
  )
}

function teclaStyle(tipo) {
  return {
    fontFamily: "'Inter Tight', sans-serif",
    fontSize: tipo === 'digito' ? 26 : 16,
    fontWeight: tipo === 'digito' ? 800 : 700,
    padding: '18px 0', borderRadius: 16, cursor: 'pointer',
    border: '2.5px solid var(--jb-line)',
    background: tipo === 'digito' ? '#fff' : 'var(--jb-cream)',
    color: 'var(--jb-ink)',
  }
}
