import { Section, AvisoVacio } from './Section'
import { f } from '../../../lib/utils'

// Mismo criterio de color que el resto de la pantalla: rosa = dinero, teal =
// cantidad — así las dos listas se distinguen de un vistazo sin leer el título.
const COLOR_DINERO = '#EA478A'
const COLOR_UNIDADES = '#0090A6'

/** Top platillos del periodo, por dinero (la que manda) y por unidades (casi
 *  nunca es la misma lista) — ver el comentario de arriba de stats.sql sobre por
 *  qué se arman de los cierres y no de lo enviado a cocina. */
export function TopPlatillos({ datos, cargando }) {
  const porDinero = datos?.por_dinero ?? []
  const porUnidades = datos?.por_unidades ?? []
  const hayDatos = porDinero.length > 0 || porUnidades.length > 0

  return (
    <Section title="Top platillos" subtitle="Por dinero manda; por unidades dice qué se antoja más.">
      {cargando && !datos ? (
        <AvisoVacio>Cargando…</AvisoVacio>
      ) : !hayDatos ? (
        <AvisoVacio>Sin ventas cerradas en este periodo.</AvisoVacio>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Ranking titulo="Por dinero" filas={porDinero} color={COLOR_DINERO} campo="dinero" />
          <Ranking titulo="Por unidades" filas={porUnidades} color={COLOR_UNIDADES} campo="unidades" />
        </div>
      )}
    </Section>
  )
}

function Ranking({ titulo, filas, color, campo }) {
  if (!filas.length) return null
  const maximo = Math.max(...filas.map((r) => Number(r[campo]) || 0), 1)

  return (
    <div>
      <h4 style={{ margin: '0 0 11px', fontSize: 12.5, fontWeight: 800, color: 'var(--jb-ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {titulo}
      </h4>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {filas.map((row, i) => (
          <li key={row.nombre}>
            <div className="flex items-center justify-between" style={{ gap: 10, fontSize: 14, marginBottom: 5 }}>
              <span style={{ fontWeight: 800, color: 'var(--jb-ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i + 1}. {row.nombre}
              </span>
              <span style={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'var(--jb-ink)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {campo === 'dinero' ? f(row.dinero) : `${Math.round(row.unidades).toLocaleString('es-MX')} pz`}
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'var(--jb-line)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(Number(row[campo]) / maximo) * 100}%`, background: color, borderRadius: 999 }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
