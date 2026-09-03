// Teclado numérico de 4 dígitos, reutilizado por el cambio de mesero (MeseroSwitcher)
// y por el gate del panel de admin (AdminEntry). Es "atribución, no seguridad": el
// PIN evita acciones bajo el nombre/rol equivocado por accidente, no protege dinero.
export function PinPad({ titulo, subtitulo, entered, error, onDigit, onBack, onCancel }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'cancel', '0', 'back']
  return (
    <>
      <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>
        {titulo}
      </h2>
      <p style={{ margin: '0 0 18px', fontSize: 15, color: error ? 'var(--jb-pink-dark)' : 'var(--jb-ink-soft)' }}>
        {error ? 'PIN incorrecto, inténtalo de nuevo' : subtitulo}
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
            return <button key={k} onClick={onCancel} style={teclaStyle('accion')}>Cancelar</button>
          }
          if (k === 'back') {
            return <button key={k} onClick={onBack} style={teclaStyle('accion')}>⌫</button>
          }
          return <button key={k} onClick={() => onDigit(k)} style={teclaStyle('digito')}>{k}</button>
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
