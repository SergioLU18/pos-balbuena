/** Chip grande de selección (ingredientes, modificadores). Pensado para dedos, no cursores.
 *  `disabled` bloquea el clic (cursor not-allowed). `dimmed` solo lo atenúa visualmente
 *  para resaltar el ya elegido, pero sigue siendo tocable (p. ej. para intercambiar).
 *  `sublabel` ocupa su propia línea (empuja el texto principal hacia arriba, ej. el
 *  costo extra de un ingrediente). `badge` en cambio flota en la esquina inferior
 *  derecha sin mover nada más (ej. "×2" de un ingrediente elegido dos veces): la
 *  palabra principal se queda centrada igual que sin badge.
 *  Dentro de `chipGrid` se estira solo al ancho de su celda; en un flex normal se
 *  ajusta a su contenido. */
export function Chip({ active, disabled, dimmed, onClick, children, sublabel, badge }) {
  const atenuado = (disabled || dimmed) && !active
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !active}
      style={{
        position: 'relative',
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
      {badge && (
        <span
          style={{
            position: 'absolute', bottom: 6, right: 10,
            fontSize: 13, fontWeight: 800,
            color: active ? 'var(--jb-pink-dark)' : 'var(--jb-gray)',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
