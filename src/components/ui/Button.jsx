const BASE = {
  fontFamily: "'Inter Tight', sans-serif",
  fontWeight: 800,
  border: 'none',
  borderRadius: 16,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  transition: 'transform 0.08s ease, opacity 0.15s ease',
}

const VARIANTS = {
  primary: { background: 'var(--jb-pink)', color: '#fff' },
  secondary: { background: '#fff', color: 'var(--jb-pink-dark)', border: '2px solid var(--jb-pink-light)' },
  ghost: { background: 'transparent', color: 'var(--jb-ink-soft)' },
  ok: { background: 'var(--jb-ok)', color: '#fff' },
}

const SIZES = {
  lg: { fontSize: 20, padding: '18px 28px', minHeight: 64 },
  md: { fontSize: 16, padding: '13px 20px', minHeight: 48 },
}

export function Button({ variant = 'primary', size = 'lg', disabled, style, children, ...props }) {
  return (
    <button
      disabled={disabled}
      style={{
        ...BASE,
        ...VARIANTS[variant],
        ...SIZES[size],
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      {...props}
    >
      {children}
    </button>
  )
}
