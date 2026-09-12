import { useState } from 'react'
import { Button } from '../ui/Button'
import { f } from '../../lib/utils'

const METODOS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'ambos', label: 'Ambos (efectivo + tarjeta)' },
]

// Con qué se pagó, para la frase de confirmación de un método único ("...en efectivo" /
// "...con tarjeta") — cada uno lleva su propia preposición porque no suenan igual.
const CONFIRMACION = {
  efectivo: 'en efectivo',
  tarjeta: 'con tarjeta',
}

const inputStyle = {
  border: '2.5px solid var(--jb-line)', borderRadius: 14, padding: '13px 14px',
  fontFamily: "'Inter Tight', sans-serif", fontSize: 17, fontWeight: 700, outline: 'none',
  color: 'var(--jb-ink)', background: '#fff', minWidth: 0, width: '100%', textAlign: 'right',
}

// Un pago tolera hasta un centavo de diferencia contra el total: el redondeo de
// centavos entre efectivo y tarjeta no debe bloquear el cierre por $0.005 de sobra.
const TOLERANCIA = 0.01

// Segundo paso al cerrar una mesa: una vez confirmado el cierre (ConfirmModal), el
// mesero elige con qué se pagó. Efectivo/Tarjeta piden una confirmación extra (es fácil
// tocar el botón equivocado, y no hay forma de deshacer un cierre) antes de disparar
// onSelect. "Ambos" abre un tercer paso para repartir el total entre los dos — hace
// falta saber cuánto entró de cada uno para la caja.
export function MetodoPagoModal({ titulo = '¿Cómo pagó la mesa?', total = 0, onSelect, onClose }) {
  // 'elegir' (paso 1) | 'confirmar' (paso 2, solo efectivo/tarjeta) | 'ambos' (paso 2 alterno)
  const [paso, setPaso] = useState('elegir')
  const [pendiente, setPendiente] = useState(null) // método en confirmación ('efectivo' | 'tarjeta')
  const [efectivo, setEfectivo] = useState('')
  const [tarjeta, setTarjeta] = useState('')

  const numEfectivo = Number(efectivo) || 0
  const numTarjeta = Number(tarjeta) || 0
  const restante = total - numEfectivo - numTarjeta
  const cuadra = Math.abs(restante) <= TOLERANCIA && (efectivo !== '' || tarjeta !== '')

  function elegir(metodo) {
    if (metodo === 'ambos') { setPaso('ambos'); return }
    setPendiente(metodo)
    setPaso('confirmar')
  }

  function confirmarUnico() {
    onSelect(pendiente)
  }

  function confirmarAmbos() {
    if (!cuadra) return
    onSelect('ambos', { efectivo: numEfectivo, tarjeta: numTarjeta })
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20,
      }}
    >
      <div
        className="jb-pop"
        style={{
          background: '#fff', borderRadius: 26, width: 440, maxWidth: '100%',
          fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
          padding: '28px 30px', display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        {paso === 'confirmar' ? (
          <>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)', textAlign: 'center' }}>
              Confirmación
            </h2>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--jb-ink)', lineHeight: 1.4, textAlign: 'center' }}>
              ¿Estás seguro que <strong>toda</strong> la mesa se pagó <strong>{CONFIRMACION[pendiente]}</strong>?
            </p>

            <Button variant="primary" size="lg" onClick={confirmarUnico} style={{ width: '100%', marginTop: 8 }}>
              Sí, cerrar mesa
            </Button>
            <Button variant="ghost" size="md" onClick={() => setPaso('elegir')} style={{ marginTop: 0 }}>
              ← No, volver
            </Button>
          </>
        ) : paso === 'ambos' ? (
          <>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>
              ¿Cuánto de cada uno?
            </h2>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--jb-ink-soft)' }}>
              Total de la cuenta: <strong style={{ color: 'var(--jb-ink)' }}>{f(total)}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--jb-ink-soft)' }}>Efectivo</span>
                <input
                  value={efectivo}
                  onChange={(e) => setEfectivo(e.target.value.replace(/[^\d.]/g, ''))}
                  type="number" min="0" step="0.01" inputMode="decimal" placeholder="$0.00"
                  aria-label="Cantidad pagada en efectivo"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--jb-ink-soft)' }}>Tarjeta</span>
                <input
                  value={tarjeta}
                  onChange={(e) => setTarjeta(e.target.value.replace(/[^\d.]/g, ''))}
                  type="number" min="0" step="0.01" inputMode="decimal" placeholder="$0.00"
                  aria-label="Cantidad pagada con tarjeta"
                  style={inputStyle}
                />
              </label>

              {!cuadra && (efectivo !== '' || tarjeta !== '') && (
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--jb-pink-dark)' }}>
                  {restante > 0 ? `Falta ${f(restante)}` : `Sobra ${f(-restante)}`} para llegar al total.
                </p>
              )}
            </div>

            <Button variant="ok" size="lg" onClick={confirmarAmbos} disabled={!cuadra} style={{ width: '100%', marginTop: 4 }}>
              Confirmar cierre
            </Button>
            <Button variant="ghost" size="md" onClick={() => setPaso('elegir')} style={{ marginTop: 0 }}>
              ← Volver
            </Button>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>{titulo}</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              {METODOS.map((m) => (
                <Button key={m.id} variant="secondary" size="lg" onClick={() => elegir(m.id)} style={{ width: '100%' }}>
                  {m.label}
                </Button>
              ))}
            </div>

            <p style={{
              margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--jb-ink-soft)',
              background: 'var(--jb-cream)', borderRadius: 12, padding: '10px 14px', lineHeight: 1.4,
            }}>
              Si el cliente pagó con <strong style={{ color: 'var(--jb-ink)', fontWeight: 900 }}>Tali</strong>, no hace falta registrarlo aquí — ese cobro se cierra solo.
            </p>

            <Button variant="ghost" size="md" onClick={onClose} style={{ marginTop: 4 }}>
              Cancelar
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
