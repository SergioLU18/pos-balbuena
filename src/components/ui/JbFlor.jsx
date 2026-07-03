// Ícono decorativo: el azulejo de 5 flores del logo real de Jardín Balbuena,
// recreado en SVG (no depende del asset original del sitio).
export function JbFlor({ size = 16, color = 'var(--jb-pink)', petals = 'white' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill={color} />
      <g fill={petals}>
        <Flor cx={7.2} cy={7.2} />
        <Flor cx={16.8} cy={7.2} />
        <Flor cx={12} cy={12} />
        <Flor cx={7.2} cy={16.8} />
        <Flor cx={16.8} cy={16.8} />
      </g>
    </svg>
  )
}

function Flor({ cx, cy }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <ellipse cx="0" cy="-1.6" rx="1.15" ry="1.6" />
      <ellipse cx="0" cy="1.6" rx="1.15" ry="1.6" />
      <ellipse cx="-1.6" cy="0" rx="1.6" ry="1.15" />
      <ellipse cx="1.6" cy="0" rx="1.6" ry="1.15" />
    </g>
  )
}
