import { useState } from 'react'
import { ModalShell } from '../admin/AdminModal'
import { Button } from '../ui/Button'
import { WheelPicker } from '../ui/WheelPicker'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DIAS = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))
const MESES_ITEMS = MESES.map((nombre, i) => ({ value: i + 1, label: nombre }))
const ANIO_ACTUAL = new Date().getFullYear()
// 100 años hacia atrás alcanza de sobra para una fecha de nacimiento. Más reciente
// arriba: se desliza hacia abajo para llegar a los años más viejos.
const ANIOS = Array.from({ length: 101 }, (_, i) => {
  const anio = ANIO_ACTUAL - i
  return { value: anio, label: String(anio) }
})

/** Selector de cumpleaños propio de pos-balbuena: tres ruedas deslizables
 *  (día 1–31, mes, año) en vez del <input type="date"> del sistema, que en
 *  tablet se ve distinto según el navegador. `value` es "YYYY-MM-DD" o null. */
export function FechaNacimientoModal({ value, onConfirm, onQuitar, onClose }) {
  const inicial = value ? value.split('-').map(Number) : null
  const [dia, setDia] = useState(inicial?.[2] ?? 1)
  const [mes, setMes] = useState(inicial?.[1] ?? 1)
  const [anio, setAnio] = useState(inicial?.[0] ?? ANIO_ACTUAL - 30)

  function confirmar() {
    const mm = String(mes).padStart(2, '0')
    const dd = String(dia).padStart(2, '0')
    onConfirm(`${anio}-${mm}-${dd}`)
  }

  return (
    <ModalShell width={400} titulo="Cumpleaños" onClose={onClose}>
      <div className="flex" style={{ gap: 6 }}>
        <WheelPicker items={DIAS} value={dia} onChange={setDia} />
        <WheelPicker items={MESES_ITEMS} value={mes} onChange={setMes} />
        <WheelPicker items={ANIOS} value={anio} onChange={setAnio} />
      </div>

      {value && onQuitar && (
        <button
          onClick={onQuitar}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center',
            fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 800, color: '#C24A4A',
            padding: '4px 0',
          }}
        >
          Quitar fecha
        </button>
      )}

      <div className="flex" style={{ gap: 12, marginTop: 4 }}>
        <Button variant="secondary" size="md" onClick={onClose} style={{ flex: 1 }}>Cancelar</Button>
        <Button size="md" onClick={confirmar} style={{ flex: 1 }}>Aceptar</Button>
      </div>
    </ModalShell>
  )
}
