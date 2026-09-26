import { useState } from 'react'
import { Button } from '../ui/Button'
import { f } from '../../lib/utils'

const METODOS = [
  { id: 'efectivo', label: 'Todo en efectivo' },
  { id: 'tarjeta', label: 'Todo en tarjeta' },
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

const tabStyle = (activo) => ({
  flex: 1, border: `2px solid ${activo ? 'var(--jb-pink)' : 'var(--jb-line)'}`,
  background: activo ? 'var(--jb-pink-tint)' : '#fff', color: activo ? 'var(--jb-pink-dark)' : 'var(--jb-ink-soft)',
  borderRadius: 12, padding: '9px 0', fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 800, cursor: 'pointer',
})

const chipStyle = (activo) => ({
  border: `2px solid ${activo ? 'var(--jb-pink)' : 'var(--jb-line)'}`,
  background: activo ? 'var(--jb-pink)' : '#fff', color: activo ? '#fff' : 'var(--jb-ink-soft)',
  borderRadius: 10, padding: '6px 12px', fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 800, cursor: 'pointer',
})

// Un pago tolera hasta un centavo de diferencia contra el total: el redondeo de
// centavos entre efectivo y tarjeta no debe bloquear el cierre por $0.005 de sobra.
const TOLERANCIA = 0.01

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

/** Cuánta propina, según el modo elegido: monto fijo o porcentaje de `base` (lo que se
 *  pagó por ese método — o el total de la cuenta cuando no hay reparto). Nunca negativo. */
function montoPropina(modo, cantidad, porcentaje, base) {
  const monto = modo === 'porcentaje' ? base * (Number(porcentaje) || 0) / 100 : Number(cantidad) || 0
  return round2(Math.max(0, monto))
}

/** "(10%)" para el renglón de propina en la confirmación final — el porcentaje que
 *  representa `monto` sobre `base`, sin importar si se capturó como monto fijo o como
 *  porcentaje (en monto fijo es el equivalente, para que el mesero vea qué tan generosa
 *  fue la propina). Sin base (nada pagado por ese método) no hay nada que mostrar. */
function sufijoPorcentaje(monto, base) {
  if (!base) return ''
  const pct = Math.round((monto / base) * 1000) / 10
  const texto = Number.isInteger(pct) ? String(pct) : pct.toFixed(1)
  return ` (${texto}%)`
}

/** Campo de captura de propina: toggle Cantidad/Porcentaje + input, con chips de
 *  porcentajes comunes. `base` es el monto sobre el que se calcula el porcentaje. La
 *  propina es siempre opcional — en blanco equivale a $0, no hay nada que validar aquí. */
function PropinaCampo({ label, base, modo, setModo, cantidad, setCantidad, porcentaje, setPorcentaje }) {
  const monto = montoPropina(modo, cantidad, porcentaje, base)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--jb-ink-soft)' }}>{label}</span>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setModo('cantidad')} style={tabStyle(modo === 'cantidad')}>Cantidad</button>
        <button type="button" onClick={() => setModo('porcentaje')} style={tabStyle(modo === 'porcentaje')}>Porcentaje</button>
      </div>

      {modo === 'cantidad' ? (
        <input
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value.replace(/[^\d.]/g, ''))}
          type="number" min="0" step="0.01" inputMode="decimal" placeholder="$0.00"
          aria-label={label}
          style={inputStyle}
        />
      ) : (
        <>
          {/* Mismo layout de dos columnas que las pestañas de arriba (flex:1 + gap:8), para
              que los chips queden exactamente debajo de "Porcentaje" y no de "Cantidad". */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }} />
            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
              {[10, 15, 20].map((p) => (
                <button key={p} type="button" onClick={() => setPorcentaje(String(p))} style={chipStyle(porcentaje === String(p))}>
                  {p}%
                </button>
              ))}
            </div>
          </div>
          {/* El "%" va como adorno fijo aparte del input, no metido en su value: ponerlo
              dentro del texto editable se comía el backspace al final sin que nada
              cambiara (el "%" no es un dígito, así que la regex lo descartaba y el
              valor volvía a verse igual) y daba la impresión de que no se podía borrar. */}
          <div style={{ position: 'relative' }}>
            <input
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value.replace(/[^\d.]/g, ''))}
              type="text" inputMode="decimal" placeholder="0"
              aria-label={`${label} (porcentaje)`}
              style={{ ...inputStyle, paddingRight: 34 }}
            />
            <span style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 17, fontWeight: 700, color: 'var(--jb-ink)', pointerEvents: 'none',
            }}>
              %
            </span>
          </div>
        </>
      )}

      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--jb-ink-soft)' }}>
        Propina: <strong style={{ color: 'var(--jb-ink)' }}>{f(monto)}</strong>
      </p>
    </div>
  )
}

/** Renglón del desglose final (cuánto es la cuenta, cuánto la propina, cuánto se cobra
 *  en total). `fuerte` marca el total, que se ve más grande y en negro. */
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

// Cierre de mesa: elegir (paso 1) -> con qué se pagó -> propina -> confirmación final con
// desglose -> onSelect dispara el cierre real. "Efectivo"/"Tarjeta" van directo a su propio
// campo de propina; "Ambos" primero reparte el total entre los dos (paso 'ambos', igual que
// antes) y luego pide la propina de cada método por separado (paso 'propinaAmbos') porque
// pueden venir en montos distintos. La confirmación final (paso 'confirmar') es la que de
// verdad cierra la mesa — no hay forma de deshacerlo después.
export function MetodoPagoModal({ titulo = '¿Cómo pagó la mesa?', total = 0, onSelect, onClose }) {
  // 'elegir' | 'ambos' (repartir el total) | 'propina' (único método) |
  // 'propinaAmbos' (propina de cada método) | 'confirmar' (desglose final)
  const [paso, setPaso] = useState('elegir')
  const [pendiente, setPendiente] = useState(null) // método en confirmación ('efectivo' | 'tarjeta'), null en 'ambos'
  const [efectivo, setEfectivo] = useState('')
  const [tarjeta, setTarjeta] = useState('')

  // Propina de un método único. Porcentaje por default: es como la pide la mayoría
  // de los clientes ("déjale el 15%"), monto fijo es la excepción.
  const [propinaModo, setPropinaModo] = useState('porcentaje')
  const [propinaCantidad, setPropinaCantidad] = useState('')
  const [propinaPorcentaje, setPropinaPorcentaje] = useState('')

  // Propina repartida (caso "Ambos"): una captura por método.
  const [propinaEfModo, setPropinaEfModo] = useState('porcentaje')
  const [propinaEfCantidad, setPropinaEfCantidad] = useState('')
  const [propinaEfPorcentaje, setPropinaEfPorcentaje] = useState('')
  const [propinaTarModo, setPropinaTarModo] = useState('porcentaje')
  const [propinaTarCantidad, setPropinaTarCantidad] = useState('')
  const [propinaTarPorcentaje, setPropinaTarPorcentaje] = useState('')

  const numEfectivo = Number(efectivo) || 0
  const numTarjeta = Number(tarjeta) || 0
  const restante = total - numEfectivo - numTarjeta
  const cuadra = Math.abs(restante) <= TOLERANCIA && (efectivo !== '' || tarjeta !== '')

  // Placeholder "sugerido" del campo vacío: lo que falta para llegar al total, según lo
  // que ya se escribió en el otro. Solo se sugiere cuando de verdad falta algo — si ya
  // se pasó del total, mejor no sugerir un número negativo, se queda el "$0.00" de siempre.
  const sugerenciaEfectivo = efectivo === '' && tarjeta !== '' && round2(total - numTarjeta) > 0
    ? round2(total - numTarjeta) : null
  const sugerenciaTarjeta = tarjeta === '' && efectivo !== '' && round2(total - numEfectivo) > 0
    ? round2(total - numEfectivo) : null

  const numPropina = montoPropina(propinaModo, propinaCantidad, propinaPorcentaje, total)
  const numPropinaEf = montoPropina(propinaEfModo, propinaEfCantidad, propinaEfPorcentaje, numEfectivo)
  const numPropinaTar = montoPropina(propinaTarModo, propinaTarCantidad, propinaTarPorcentaje, numTarjeta)

  function elegir(metodo) {
    if (metodo === 'ambos') { setPaso('ambos'); return }
    setPendiente(metodo)
    setPaso('propina')
  }

  function confirmarCierre() {
    if (pendiente) {
      onSelect(pendiente, {
        propinaEfectivo: pendiente === 'efectivo' ? numPropina : 0,
        propinaTarjeta: pendiente === 'tarjeta' ? numPropina : 0,
      })
      return
    }
    onSelect('ambos', {
      efectivo: numEfectivo, tarjeta: numTarjeta,
      propinaEfectivo: numPropinaEf, propinaTarjeta: numPropinaTar,
    })
  }

  const totalPropina = pendiente ? numPropina : numPropinaEf + numPropinaTar
  const totalACobrar = total + totalPropina

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
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {paso === 'propina' ? (
          <>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>Propina</h2>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--jb-ink-soft)' }}>
              Cuenta ({CONFIRMACION[pendiente]}): <strong style={{ color: 'var(--jb-ink)' }}>{f(total)}</strong>
            </p>

            <PropinaCampo
              label="Propina"
              base={total}
              modo={propinaModo} setModo={setPropinaModo}
              cantidad={propinaCantidad} setCantidad={setPropinaCantidad}
              porcentaje={propinaPorcentaje} setPorcentaje={setPropinaPorcentaje}
            />

            <Button variant="primary" size="lg" onClick={() => setPaso('confirmar')} style={{ width: '100%', marginTop: 4 }}>
              Continuar
            </Button>
            <Button variant="ghost" size="md" onClick={() => setPaso('elegir')} style={{ marginTop: 0 }}>
              ← Volver
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

            <Button variant="ok" size="lg" onClick={() => setPaso('propinaAmbos')} disabled={!cuadra} style={{ width: '100%', marginTop: 4 }}>
              Continuar
            </Button>
            <Button variant="ghost" size="md" onClick={() => setPaso('elegir')} style={{ marginTop: 0 }}>
              ← Volver
            </Button>
          </>
        ) : paso === 'propinaAmbos' ? (
          <>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>Propina</h2>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--jb-ink-soft)' }}>
              Efectivo {f(numEfectivo)} · Tarjeta {f(numTarjeta)}
            </p>

            <PropinaCampo
              label="Propina en efectivo"
              base={numEfectivo}
              modo={propinaEfModo} setModo={setPropinaEfModo}
              cantidad={propinaEfCantidad} setCantidad={setPropinaEfCantidad}
              porcentaje={propinaEfPorcentaje} setPorcentaje={setPropinaEfPorcentaje}
            />
            <PropinaCampo
              label="Propina con tarjeta"
              base={numTarjeta}
              modo={propinaTarModo} setModo={setPropinaTarModo}
              cantidad={propinaTarCantidad} setCantidad={setPropinaTarCantidad}
              porcentaje={propinaTarPorcentaje} setPorcentaje={setPropinaTarPorcentaje}
            />

            <Button variant="primary" size="lg" onClick={() => setPaso('confirmar')} style={{ width: '100%', marginTop: 4 }}>
              Continuar
            </Button>
            <Button variant="ghost" size="md" onClick={() => setPaso('ambos')} style={{ marginTop: 0 }}>
              ← Volver
            </Button>
          </>
        ) : paso === 'confirmar' ? (
          <>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)', textAlign: 'center' }}>
              Confirmación
            </h2>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--jb-ink)', lineHeight: 1.4, textAlign: 'center' }}>
              Se va a cerrar la mesa {pendiente ? CONFIRMACION[pendiente] : 'con efectivo y tarjeta'}. Esto no se puede deshacer.
            </p>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4,
              background: 'var(--jb-cream)', borderRadius: 16, padding: '16px 18px',
            }}>
              <Renglon label="Cuenta" valor={total} />
              {pendiente ? (
                <Renglon label={`Propina${sufijoPorcentaje(numPropina, total)}`} valor={numPropina} />
              ) : (
                <>
                  <Renglon label="Efectivo" valor={numEfectivo} />
                  <Renglon label={`Propina en efectivo${sufijoPorcentaje(numPropinaEf, numEfectivo)}`} valor={numPropinaEf} />
                  <Renglon label="Tarjeta" valor={numTarjeta} />
                  <Renglon label={`Propina con tarjeta${sufijoPorcentaje(numPropinaTar, numTarjeta)}`} valor={numPropinaTar} />
                </>
              )}
              <div style={{ borderTop: '2px solid var(--jb-line)', margin: '4px 0' }} />
              <Renglon label="Total a cobrar" valor={totalACobrar} fuerte />
            </div>

            <Button variant="primary" size="lg" onClick={confirmarCierre} style={{ width: '100%', marginTop: 8 }}>
              Sí, cerrar mesa
            </Button>
            <Button variant="ghost" size="md" onClick={() => setPaso(pendiente ? 'propina' : 'propinaAmbos')} style={{ marginTop: 0 }}>
              ← No, volver
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
