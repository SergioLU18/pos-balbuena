import { useState } from 'react'
import { Button } from '../ui/Button'
import { f } from '../../lib/utils'

const METODOS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'ambos', label: 'Ambos (efectivo + tarjeta)' },
]

const CONFIRMACION = { efectivo: 'en efectivo', tarjeta: 'con tarjeta', ambos: 'con efectivo y tarjeta' }

// Un pago tolera hasta un centavo de diferencia contra el total: el redondeo de
// centavos entre efectivo y tarjeta no debe bloquear el cobro por $0.005 de sobra.
const TOLERANCIA = 0.01
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

const inputStyle = {
  border: '2.5px solid var(--jb-line)', borderRadius: 14, padding: '13px 14px',
  fontFamily: "'Inter Tight', sans-serif", fontSize: 17, fontWeight: 700, outline: 'none',
  color: 'var(--jb-ink)', background: '#fff', minWidth: 0, width: '100%', textAlign: 'right',
}

function Renglon({ label, valor, fuerte = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: fuerte ? 17 : 15, fontWeight: fuerte ? 900 : 700, color: fuerte ? 'var(--jb-ink)' : 'var(--jb-ink-soft)' }}>
        {label}
      </span>
      <span style={{ fontSize: fuerte ? 20 : 15, fontWeight: fuerte ? 900 : 700, color: 'var(--jb-ink)' }}>
        {f(valor)}
      </span>
    </div>
  )
}

/** Cobro de una orden para llevar: elegir método -> (si es "ambos") repartir el total ->
 *  confirmación. Sin propina — eso solo aplica al servicio de mesa (ver
 *  MetodoPagoModal). El pago congela la orden (ya no se le pueden agregar platillos, un
 *  faltante es un pedido nuevo), así que la confirmación es explícita sobre que no hay
 *  marcha atrás. */
export function PagarLlevarModal({ total = 0, onSelect, onClose }) {
  const [paso, setPaso] = useState('elegir') // 'elegir' | 'ambos' | 'confirmar'
  const [metodo, setMetodo] = useState(null)
  const [efectivo, setEfectivo] = useState('')
  const [tarjeta, setTarjeta] = useState('')

  const numEfectivo = Number(efectivo) || 0
  const numTarjeta = Number(tarjeta) || 0
  const restante = total - numEfectivo - numTarjeta
  const cuadra = Math.abs(restante) <= TOLERANCIA && (efectivo !== '' || tarjeta !== '')

  const sugerenciaEfectivo = efectivo === '' && tarjeta !== '' && round2(total - numTarjeta) > 0
    ? round2(total - numTarjeta) : null
  const sugerenciaTarjeta = tarjeta === '' && efectivo !== '' && round2(total - numEfectivo) > 0
    ? round2(total - numEfectivo) : null

  function elegir(m) {
    setMetodo(m)
    setPaso(m === 'ambos' ? 'ambos' : 'confirmar')
  }

  function confirmar() {
    if (metodo === 'ambos') {
      onSelect('ambos', { efectivo: numEfectivo, tarjeta: numTarjeta })
    } else {
      onSelect(metodo, {})
    }
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
          background: '#fff', borderRadius: 26, width: 420, maxWidth: '100%',
          fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
          padding: '28px 30px', display: 'flex', flexDirection: 'column', gap: 12,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {paso === 'ambos' ? (
          <>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>
              ¿Cuánto de cada uno?
            </h2>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--jb-ink-soft)' }}>
              Total de la orden: <strong style={{ color: 'var(--jb-ink)' }}>{f(total)}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--jb-ink-soft)' }}>Efectivo</span>
                <input
                  value={efectivo}
                  onChange={(e) => setEfectivo(e.target.value.replace(/[^\d.]/g, ''))}
                  type="number" min="0" step="0.01" inputMode="decimal"
                  placeholder={sugerenciaEfectivo != null ? f(sugerenciaEfectivo) : '$0.00'}
                  aria-label="Cantidad pagada en efectivo"
                  className="jb-placeholder-tenue"
                  style={{ ...inputStyle, border: sugerenciaEfectivo != null ? '2.5px dashed var(--jb-gray)' : inputStyle.border }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--jb-ink-soft)' }}>Tarjeta</span>
                <input
                  value={tarjeta}
                  onChange={(e) => setTarjeta(e.target.value.replace(/[^\d.]/g, ''))}
                  type="number" min="0" step="0.01" inputMode="decimal"
                  placeholder={sugerenciaTarjeta != null ? f(sugerenciaTarjeta) : '$0.00'}
                  aria-label="Cantidad pagada con tarjeta"
                  className="jb-placeholder-tenue"
                  style={{ ...inputStyle, border: sugerenciaTarjeta != null ? '2.5px dashed var(--jb-gray)' : inputStyle.border }}
                />
              </label>

              {!cuadra && (efectivo !== '' || tarjeta !== '') && (
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--jb-pink-dark)' }}>
                  {restante > 0 ? `Falta ${f(restante)}` : `Sobra ${f(-restante)}`} para llegar al total.
                </p>
              )}
            </div>

            <Button variant="ok" size="lg" onClick={() => setPaso('confirmar')} disabled={!cuadra} style={{ width: '100%', marginTop: 4 }}>
              Continuar
            </Button>
            <Button variant="ghost" size="md" onClick={() => setPaso('elegir')} style={{ marginTop: 0 }}>
              ← Volver
            </Button>
          </>
        ) : paso === 'confirmar' ? (
          <>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)', textAlign: 'center' }}>
              Confirmación
            </h2>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--jb-ink)', lineHeight: 1.4, textAlign: 'center' }}>
              Se va a marcar como pagada {CONFIRMACION[metodo]}. Ya no se le podrán agregar platillos — si falta algo, es un pedido nuevo.
            </p>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4,
              background: 'var(--jb-cream)', borderRadius: 16, padding: '16px 18px',
            }}>
              {metodo === 'ambos' && (
                <>
                  <Renglon label="Efectivo" valor={numEfectivo} />
                  <Renglon label="Tarjeta" valor={numTarjeta} />
                  <div style={{ borderTop: '2px solid var(--jb-line)', margin: '4px 0' }} />
                </>
              )}
              <Renglon label="Total" valor={total} fuerte />
            </div>

            <Button variant="primary" size="lg" onClick={confirmar} style={{ width: '100%', marginTop: 8 }}>
              Sí, marcar como pagada
            </Button>
            <Button variant="ghost" size="md" onClick={() => setPaso(metodo === 'ambos' ? 'ambos' : 'elegir')} style={{ marginTop: 0 }}>
              ← No, volver
            </Button>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>¿Cómo pagó?</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              {METODOS.map((m) => (
                <Button key={m.id} variant="secondary" size="lg" onClick={() => elegir(m.id)} style={{ width: '100%' }}>
                  {m.label}
                </Button>
              ))}
            </div>

            <Button variant="ghost" size="md" onClick={onClose} style={{ marginTop: 4 }}>
              Cancelar
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
