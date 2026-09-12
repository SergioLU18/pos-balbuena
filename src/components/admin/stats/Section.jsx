import { STATUS } from '../../../lib/statsColors'

// Piezas compartidas por todas las tarjetas de Estadísticas: la misma tarjeta
// blanca con borde que ya usa el resto del admin (ver AdminMesasPage.jsx), un
// número grande con su etiqueta, y la insignia ▲/▼ de comparación contra otro
// periodo. Vivir en un solo archivo evita que cada gráfica reinvente su propio
// padding/borde y que se vean como pantallas distintas pegadas una a otra.

export function Section({ title, subtitle, action, children }) {
  return (
    <section
      style={{
        background: '#fff', border: '2px solid var(--jb-line)', borderRadius: 20,
        padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      <div className="flex items-start justify-between flex-wrap" style={{ gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--jb-ink)' }}>{title}</h3>
          {subtitle && (
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--jb-ink-soft)', lineHeight: 1.4 }}>{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function StatTile({ label, valor, acento = false, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--jb-ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 26, fontWeight: 900, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
          color: acento ? 'var(--jb-pink-dark)' : 'var(--jb-ink)',
        }}
      >
        {valor}
      </span>
      {children}
    </div>
  )
}

// ▲/▼ N% · etiqueta, con una pastilla de fondo tenue del mismo tono: el texto
// solo (sin relleno) no llega a 3:1 de contraste sobre el crema del fondo a este
// tamaño — la pastilla es lo que lo hace legible, no adorno (ver
// src/lib/statsColors.js).
export function Comparativo({ actual, anterior, etiqueta }) {
  if (anterior == null) return null
  if (!anterior) {
    if (!actual) return null
    return (
      <Pastilla color={STATUS.sube} fondo="var(--jb-ok-bg)">
        ▲ nuevo · {etiqueta}
      </Pastilla>
    )
  }
  const delta = (actual - anterior) / anterior
  const sube = delta >= 0
  const pct = Math.abs(delta * 100)
  return (
    <Pastilla color={sube ? STATUS.sube : STATUS.baja} fondo={sube ? 'var(--jb-ok-bg)' : 'var(--jb-down-bg)'}>
      {sube ? '▲' : '▼'} {pct >= 10 ? Math.round(pct) : pct.toFixed(1)}%
      <span style={{ color: 'var(--jb-ink-soft)', fontWeight: 700 }}> {etiqueta}</span>
    </Pastilla>
  )
}

function Pastilla({ color, fondo, children }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
        fontSize: 12.5, fontWeight: 800, color, background: fondo,
        padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// Aviso reutilizado por cada gráfica cuando no hay datos que dibujar — mismo
// tono que el aviso de la Bitácora (AdminBitacoraPage.jsx), para que "no hay
// nada que mostrar" se vea igual en toda la pantalla.
export function AvisoVacio({ children }) {
  return (
    <p style={{
      margin: 0, fontSize: 14, color: 'var(--jb-ink-soft)', background: 'var(--jb-cream)',
      borderRadius: 12, padding: '14px 16px', lineHeight: 1.4,
    }}>
      {children}
    </p>
  )
}
