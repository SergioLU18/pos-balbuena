import { ymdLocal } from '../../../lib/statsRangos'

const OPCIONES = [['dia', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['personalizado', 'Personalizado']]

const chip = (activo) => ({
  fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 800,
  padding: '10px 16px', minHeight: 44, borderRadius: 11, cursor: 'pointer',
  border: `2px solid ${activo ? 'var(--jb-pink)' : 'var(--jb-line)'}`,
  background: activo ? 'var(--jb-pink)' : '#fff',
  color: activo ? '#fff' : 'var(--jb-ink-soft)',
})

const inputEstilo = {
  fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 700,
  padding: '9px 10px', minHeight: 40, borderRadius: 10,
  border: '2px solid var(--jb-line)', background: '#fff', color: 'var(--jb-ink)',
}

/** Hoy / Semana / Mes / Personalizado, para todo lo que se corta por periodo en
 *  Estadísticas (el heatmap y "del mes" no lo usan — son fijos, ver
 *  EstadisticasSection). "Personalizado" abre dos <input type=date>. */
export function PeriodoTabs({ periodo, onPeriodo, personalizado, onPersonalizado }) {
  const hoy = ymdLocal()
  return (
    <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
      {OPCIONES.map(([valor, texto]) => (
        <button key={valor} type="button" onClick={() => onPeriodo(valor)} aria-pressed={periodo === valor} style={chip(periodo === valor)}>
          {texto}
        </button>
      ))}
      {periodo === 'personalizado' && (
        <div className="flex items-center" style={{ gap: 6 }}>
          <input
            type="date" value={personalizado.desde} max={personalizado.hasta || hoy}
            onChange={(e) => e.target.value && onPersonalizado({ ...personalizado, desde: e.target.value })}
            aria-label="Desde" style={inputEstilo}
          />
          <span style={{ color: 'var(--jb-ink-soft)', fontWeight: 800 }}>–</span>
          <input
            type="date" value={personalizado.hasta} min={personalizado.desde} max={hoy}
            onChange={(e) => e.target.value && onPersonalizado({ ...personalizado, hasta: e.target.value })}
            aria-label="Hasta" style={inputEstilo}
          />
        </div>
      )}
    </div>
  )
}
