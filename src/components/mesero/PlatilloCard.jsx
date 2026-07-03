import { f } from '../../lib/utils'

export function PlatilloCard({ platillo, onClick }) {
  const tiers = platillo.tortillas ? platillo.tortillas.flatMap((t) => t.tiers) : platillo.tiers
  const precios = tiers.map((t) => t.precio)
  const min = Math.min(...precios)
  const max = Math.max(...precios)

  return (
    <button
      onClick={onClick}
      style={{
        background: '#fff',
        border: '3px solid var(--jb-line)',
        borderRadius: 24,
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: "'Inter Tight', sans-serif",
        minHeight: 148,
        transition: 'transform 0.1s ease',
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>{platillo.nombre}</span>
      <span style={{ fontSize: 14, color: 'var(--jb-ink-soft)', lineHeight: 1.35 }}>{platillo.base}</span>
      <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--jb-pink-dark)', marginTop: 4 }}>
        {min === max ? f(min) : `${f(min)} – ${f(max)}`}
      </span>
    </button>
  )
}
