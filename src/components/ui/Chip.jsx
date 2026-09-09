/** Chip grande de selección (ingredientes, modificadores). Pensado para dedos, no cursores.
 *  `disabled` bloquea el clic (cursor not-allowed). `dimmed` solo lo atenúa visualmente
 *  para resaltar el ya elegido, pero sigue siendo tocable (p. ej. para intercambiar).
 *  Dentro de `chipGrid` se estira solo al ancho de su celda; en un flex normal se
 *  ajusta a su contenido. */
export function Chip({ active, disabled, dimmed, onClick, children, sublabel }) {
  const atenuado = (disabled || dimmed) && !active
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !active}
      style={{
        fontFamily: "'Inter Tight', sans-serif",
        fontSize: 20,
        fontWeight: 800,
        lineHeight: 1.15,
        padding: '12px 16px',
        borderRadius: 16,
        border: active ? '3px solid var(--jb-pink)' : '3px solid var(--jb-line)',
        background: active ? 'var(--jb-pink-tint)' : '#fff',
        color: active ? 'var(--jb-pink-dark)' : 'var(--jb-ink)',
        cursor: disabled && !active ? 'not-allowed' : 'pointer',
        opacity: atenuado ? 0.4 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        overflowWrap: 'break-word',
        gap: 4,
        minHeight: 72,
        minWidth: 56,
        transition: 'all 0.12s ease',
      }}
    >
      <span>{children}</span>
      {sublabel && (
        <span style={{ fontSize: 15, fontWeight: 700, color: active ? 'var(--jb-pink)' : 'var(--jb-gray)' }}>
          {sublabel}
        </span>
      )}
    </button>
  )
}
