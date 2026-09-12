import { useLlevarStore } from '../../../store/appStore'
import { nombreCompleto } from '../../../lib/cliente'
import { Section, AvisoVacio } from './Section'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Cumpleaños del mes, del padrón para llevar — el campo ya existía en
 *  `clientes` y no se usaba para nada. Chica a propósito: va al final y no
 *  necesita más que una lista. */
export function CumpleanosMes() {
  const clientes = useLlevarStore((s) => s.clientes)
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const diaActual = hoy.getDate()

  // `cumpleanos` es una columna `date` ("YYYY-MM-DD"): se parte a mano y no con
  // `new Date(iso)`, que la interpreta en UTC y en México puede correr el día
  // hacia atrás (mismo cuidado que formatearCumpleanos en lib/cliente.js).
  const delMes = clientes
    .filter((c) => c.cumpleanos)
    .map((c) => {
      const [, mes, dia] = c.cumpleanos.split('-').map(Number)
      return { ...c, mes, dia }
    })
    .filter((c) => c.mes === mesActual)
    .sort((a, b) => a.dia - b.dia)

  return (
    <Section title="Cumpleaños del mes" subtitle={`De ${MESES[mesActual - 1]}, del padrón para llevar.`}>
      {!delMes.length ? (
        <AvisoVacio>Nadie del padrón cumple años este mes.</AvisoVacio>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {delMes.map((c) => {
            const esHoy = c.dia === diaActual
            return (
              <li key={c.id} className="flex items-center justify-between" style={{ gap: 10, fontSize: 14 }}>
                <span style={{ fontWeight: 800, color: esHoy ? 'var(--jb-pink-dark)' : 'var(--jb-ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {esHoy && '🎂 '}{nombreCompleto(c)}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--jb-ink-soft)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {c.dia} de {MESES[mesActual - 1]}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
