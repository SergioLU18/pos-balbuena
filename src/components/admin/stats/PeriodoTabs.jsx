import { useState } from 'react'
import { ymdLocal } from '../../../lib/statsRangos'
import { formatearDia } from '../../../lib/utils'
import { DiaModal } from '../DiaModal'

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
 *  EstadisticasSection). "Personalizado" abre el mismo selector de día de rueditas
 *  que usa Bitácora y Cumpleaños en alta de clientes, no un <input type=date>. */
export function PeriodoTabs({ periodo, onPeriodo, personalizado, onPersonalizado }) {
  const hoy = ymdLocal()
  const [modal, setModal] = useState(null) // 'desde' | 'hasta' | null
  return (
    <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
      {OPCIONES.map(([valor, texto]) => (
        <button key={valor} type="button" onClick={() => onPeriodo(valor)} aria-pressed={periodo === valor} style={chip(periodo === valor)}>
          {texto}
        </button>
      ))}
      {periodo === 'personalizado' && (
        <div className="flex items-center" style={{ gap: 6 }}>
          <button type="button" onClick={() => setModal('desde')} aria-label="Desde" style={{ ...inputEstilo, cursor: 'pointer' }}>
            {formatearDia(personalizado.desde)}
          </button>
          <span style={{ color: 'var(--jb-ink-soft)', fontWeight: 800 }}>–</span>
          <button type="button" onClick={() => setModal('hasta')} aria-label="Hasta" style={{ ...inputEstilo, cursor: 'pointer' }}>
            {formatearDia(personalizado.hasta)}
          </button>
        </div>
      )}
      {modal === 'desde' && (
        <DiaModal
          titulo="Desde"
          value={personalizado.desde}
          max={personalizado.hasta || hoy}
          onConfirm={(iso) => { onPersonalizado({ ...personalizado, desde: iso }); setModal(null) }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'hasta' && (
        <DiaModal
          titulo="Hasta"
          value={personalizado.hasta}
          min={personalizado.desde}
          max={hoy}
          onConfirm={(iso) => { onPersonalizado({ ...personalizado, hasta: iso }); setModal(null) }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
