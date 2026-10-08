import { maquetar, COLUMNAS } from '../../lib/escpos'

// El ticket tal como sale en la térmica: mismos renglones que maquetar() manda a la
// impresora, en monoespaciada y a 48 columnas. Los renglones en letra grande se pintan
// a doble tamaño y los de doble alto se estiran solo a lo alto, igual que en papel.
// La fuente B mide 9 puntos de ancho contra 12 de la A: se pinta a 3/4 para que sus
// 64 (o 32) columnas ocupen el mismo ancho que las 48 (o 24) de la A.
const ESCALA_FUENTE_B = 9 / 12
function tamanoLetra(r) {
  const base = r.grande ? 24 : 12
  return r.fuenteB ? base * ESCALA_FUENTE_B : base
}

// Renglón normal ≈ 30 puntos de alto ≈ 1.35em; el de doble alto, el doble. `aire` (en
// puntos) lo agranda, nunca lo achica por debajo de lo que mide la letra.
function altoRenglon(r) {
  const base = r.alto ? 2.7 : 1.35
  return `${r.aire ? Math.max(base, (r.aire / 30) * 1.35) : base}em`
}

export function TicketPreview({ bloques }) {
  const renglones = maquetar(bloques)
  return (
    <div
      style={{
        background: '#fff', border: '1.5px solid var(--jb-line)', borderRadius: 6,
        padding: '18px 14px', boxShadow: '0 4px 14px var(--jb-shadow)',
        width: 'fit-content', maxWidth: '100%', overflowX: 'auto', margin: '0 auto',
      }}
    >
      <pre
        style={{
          margin: 0, fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
          fontSize: 12, lineHeight: 1.35, color: '#222', minWidth: `${COLUMNAS}ch`,
        }}
      >
        {renglones.map((r, i) => (
          <div
            key={i}
            style={{
              fontWeight: r.negrita ? 800 : 400,
              fontSize: tamanoLetra(r),
              lineHeight: r.grande ? 1.2 : undefined,
              minHeight: altoRenglon(r),
            }}
          >
            {r.alto
              ? <span style={{ display: 'inline-block', transform: 'scaleY(2)', transformOrigin: 'top left' }}>{r.texto}</span>
              : r.texto}
          </div>
        ))}
      </pre>
    </div>
  )
}
