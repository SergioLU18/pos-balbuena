export function MitadSwitch({ dividido, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: dividido ? 'var(--jb-pink-tint)' : '#fff',
        border: `2.5px solid ${dividido ? 'var(--jb-pink)' : 'var(--jb-line)'}`,
        borderRadius: 16,
        padding: '14px 18px',
        cursor: 'pointer',
        fontFamily: "'Inter Tight', sans-serif",
        width: '100%',
      }}
    >
      <span
        style={{
          width: 46,
          height: 26,
          borderRadius: 13,
          background: dividido ? 'var(--jb-pink)' : 'var(--jb-line)',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.15s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: dividido ? 23 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.15s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }}
        />
      </span>
      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--jb-ink)', textAlign: 'left' }}>
        Dividir el plato en mitades (se comparte entre dos personas)
      </span>
    </button>
  )
}
