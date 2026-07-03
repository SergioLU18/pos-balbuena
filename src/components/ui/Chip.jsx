/** Chip grande de selección (ingredientes, modificadores). Pensado para dedos, no cursores. */
export function Chip({ active, disabled, onClick, children, sublabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !active}
      style={{
        fontFamily: "'Inter Tight', sans-serif",
        fontSize: 16,
        fontWeight: 700,
        padding: '12px 18px',
        borderRadius: 14,
        border: active ? '2.5px solid var(--jb-pink)' : '2.5px solid var(--jb-line)',
        background: active ? 'var(--jb-pink-tint)' : '#fff',
        color: active ? 'var(--jb-pink-dark)' : 'var(--jb-ink)',
        cursor: disabled && !active ? 'not-allowed' : 'pointer',
        opacity: disabled && !active ? 0.4 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        minHeight: 52,
        justifyContent: 'center',
        transition: 'all 0.12s ease',
      }}
    >
      <span>{children}</span>
      {sublabel && (
        <span style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--jb-pink)' : 'var(--jb-gray)' }}>
          {sublabel}
        </span>
      )}
    </button>
  )
}
