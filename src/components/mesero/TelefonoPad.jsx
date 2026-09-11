import { formatearTelefono } from '../../lib/telefono'
import { Button } from '../ui/Button'

// Teclado numérico para capturar el teléfono del cliente. Es un teclado propio y no un
// <input type="tel"> a propósito: en la tablet, el teclado del sistema tapa media
// pantalla y se traga el resto del flujo (el historial del cliente queda debajo). Mismo
// razonamiento —y mismo lenguaje visual— que el PinPad del cambio de mesero.
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'limpiar', '0', 'back']

const LARGO = 10

export function TelefonoPad({ valor, onDigito, onBorrar, onLimpiar, onBuscar, buscando, error }) {
  const completo = valor.length === LARGO

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 14, fontWeight: 800, color: 'var(--jb-ink-soft)' }}>
          Teléfono del cliente
        </label>
        {/* El número se muestra agrupado (55 1234 5678) para que se pueda cotejar de un
            vistazo con lo que el cliente está dictando, sin contar dígitos. */}
        <div
          style={{
            marginTop: 6, background: '#fff', border: `2.5px solid ${error ? '#C24A4A' : 'var(--jb-line)'}`,
            borderRadius: 16, padding: '16px 18px', minHeight: 66,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 28, fontWeight: 900, letterSpacing: 1,
              color: valor ? 'var(--jb-ink)' : 'var(--jb-gray)',
            }}
          >
            {valor ? formatearTelefono(valor) || valor : '10 dígitos'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)', flexShrink: 0 }}>
            {valor.length}/{LARGO}
          </span>
        </div>
        {error && (
          <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 700, color: '#C24A4A' }}>{error}</p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {TECLAS.map((k) => {
          if (k === 'limpiar') return <button key={k} onClick={onLimpiar} style={tecla('accion')}>Limpiar</button>
          if (k === 'back') return <button key={k} onClick={onBorrar} style={tecla('accion')} aria-label="Borrar">⌫</button>
          return (
            <button key={k} onClick={() => onDigito(k)} disabled={completo} style={{ ...tecla('digito'), opacity: completo ? 0.4 : 1 }}>
              {k}
            </button>
          )
        })}
      </div>

      <Button onClick={onBuscar} disabled={!completo || buscando} style={{ width: '100%' }}>
        {buscando ? 'Buscando…' : 'Buscar cliente'}
      </Button>
    </div>
  )
}

function tecla(tipo) {
  return {
    fontFamily: "'Inter Tight', sans-serif",
    fontSize: tipo === 'digito' ? 26 : 15,
    fontWeight: tipo === 'digito' ? 800 : 700,
    padding: '16px 0', borderRadius: 16, cursor: 'pointer',
    border: '2.5px solid var(--jb-line)',
    background: tipo === 'digito' ? '#fff' : 'var(--jb-cream)',
    color: 'var(--jb-ink)',
  }
}
