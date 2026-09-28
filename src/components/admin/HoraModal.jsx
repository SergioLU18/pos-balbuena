import { useState } from 'react'
import { ModalShell } from './AdminModal'
import { WheelPicker } from '../ui/WheelPicker'
import { Button } from '../ui/Button'

const HORAS_ITEMS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))
// Cada 5 minutos: de sobra para un corte de caja, y más cómodo de deslizar en
// tablet que una rueda de 60 renglones.
const MINUTOS_ITEMS = Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: String(i * 5).padStart(2, '0') }))
const AMPM_ITEMS = [{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]

/** Selector de hora propio de pos-balbuena, hermano de DiaModal: tres ruedas
 *  deslizables (hora/minuto/AM-PM) en vez de un <input type="time"> del sistema,
 *  mismo motivo que DiaModal — se ve distinto según el navegador de la tablet.
 *  `value` es `{ h: 1-12, m: 0-55 (múltiplo de 5), ampm: 'AM'|'PM' }`. */
export function HoraModal({ titulo = 'Hora', value, onConfirm, onClose }) {
  const [h, setH] = useState(value.h)
  const [m, setM] = useState(value.m)
  const [ampm, setAmpm] = useState(value.ampm)

  function confirmar() {
    onConfirm({ h, m, ampm })
  }

  return (
    <ModalShell width={360} titulo={titulo} onClose={onClose}>
      <div className="flex" style={{ gap: 6 }}>
        <WheelPicker items={HORAS_ITEMS} value={h} onChange={setH} />
        <WheelPicker items={MINUTOS_ITEMS} value={m} onChange={setM} />
        <WheelPicker items={AMPM_ITEMS} value={ampm} onChange={setAmpm} />
      </div>

      <div className="flex" style={{ gap: 12, marginTop: 4 }}>
        <Button variant="secondary" size="md" onClick={onClose} style={{ flex: 1 }}>Cancelar</Button>
        <Button size="md" onClick={confirmar} style={{ flex: 1 }}>Aceptar</Button>
      </div>
    </ModalShell>
  )
}
