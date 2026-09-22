import { useState } from 'react'
import { ModalShell } from './AdminModal'
import { WheelPicker } from '../ui/WheelPicker'
import { Button } from '../ui/Button'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const MESES_ITEMS = MESES.map((nombre, i) => ({ value: i + 1, label: nombre }))
const DIAS_ITEMS = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))
const ANIO_ACTUAL = new Date().getFullYear()
// 5 años hacia atrás alcanza de sobra para filtros de bitácora y estadísticas.
const ANIOS_ITEMS = Array.from({ length: 5 }, (_, i) => ({ value: ANIO_ACTUAL - i, label: String(ANIO_ACTUAL - i) }))

/** Selector de día propio de pos-balbuena, igual al de Cumpleaños en alta de
 *  clientes: tres ruedas deslizables (día/mes/año) en vez del <input type="date">
 *  del sistema, que en tablet se ve distinto según el navegador. `min`/`max`
 *  (ambos opcionales, "YYYY-MM-DD") acotan el rango igual que esos atributos en
 *  el input nativo que este modal reemplaza — usado por Bitácora y por
 *  "Personalizado" en Estadísticas. */
export function DiaModal({ titulo = 'Día', value, min, max, onConfirm, onClose }) {
  const [anioIni, mesIni, diaIni] = value.split('-').map(Number)
  const [minAnio, minMes, minDia] = min ? min.split('-').map(Number) : []
  const [maxAnio, maxMes, maxDia] = max ? max.split('-').map(Number) : []
  const [anio, setAnio] = useState(anioIni)
  const [mes, setMes] = useState(mesIni)
  const [dia, setDia] = useState(diaIni)

  // Recorta mes/día al tope o al piso permitido cada vez que cualquier rueda
  // cambia — así nunca queda una combinación fuera de [min, max].
  function elegir(nuevoAnio, nuevoMes, nuevoDia) {
    let mm = nuevoMes
    let dd = nuevoDia
    if (max && nuevoAnio === maxAnio) {
      if (mm > maxMes) mm = maxMes
      if (mm === maxMes && dd > maxDia) dd = maxDia
    }
    if (min && nuevoAnio === minAnio) {
      if (mm < minMes) mm = minMes
      if (mm === minMes && dd < minDia) dd = minDia
    }
    setAnio(nuevoAnio)
    setMes(mm)
    setDia(dd)
  }

  const aniosDisponibles = ANIOS_ITEMS.filter((it) => (!max || it.value <= maxAnio) && (!min || it.value >= minAnio))
  const mesesDisponibles = MESES_ITEMS.filter((it) => {
    if (max && anio === maxAnio && it.value > maxMes) return false
    if (min && anio === minAnio && it.value < minMes) return false
    return true
  })
  const diasDisponibles = DIAS_ITEMS.filter((it) => {
    if (max && anio === maxAnio && mes === maxMes && it.value > maxDia) return false
    if (min && anio === minAnio && mes === minMes && it.value < minDia) return false
    return true
  })

  function confirmar() {
    const mm = String(mes).padStart(2, '0')
    const dd = String(dia).padStart(2, '0')
    onConfirm(`${anio}-${mm}-${dd}`)
  }

  return (
    <ModalShell width={400} titulo={titulo} onClose={onClose}>
      <div className="flex" style={{ gap: 6 }}>
        <WheelPicker items={diasDisponibles} value={dia} onChange={(v) => elegir(anio, mes, v)} />
        <WheelPicker items={mesesDisponibles} value={mes} onChange={(v) => elegir(anio, v, dia)} />
        <WheelPicker items={aniosDisponibles} value={anio} onChange={(v) => elegir(v, mes, dia)} />
      </div>

      <div className="flex" style={{ gap: 12, marginTop: 4 }}>
        <Button variant="secondary" size="md" onClick={onClose} style={{ flex: 1 }}>Cancelar</Button>
        <Button size="md" onClick={confirmar} style={{ flex: 1 }}>Aceptar</Button>
      </div>
    </ModalShell>
  )
}
