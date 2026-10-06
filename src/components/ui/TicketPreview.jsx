import { maquetar, COLUMNAS } from '../../lib/escpos'

// El ticket tal como sale en la térmica: mismos renglones que maquetar() manda a la
// impresora, en monoespaciada y a 48 columnas. Los renglones en letra grande se pintan
// a doble tamaño, igual que en papel.
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
              fontSize: r.grande ? 24 : undefined,
              lineHeight: r.grande ? 1.2 : undefined,
              minHeight: '1.35em',
            }}
          >
            {r.texto}
          </div>
        ))}
      </pre>
    </div>
  )
}
