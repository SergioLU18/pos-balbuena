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

  // Las tres ruedas siempre muestran su rango completo (nunca "algunos meses sí,
  // otros no"); lo que hace `elegir` es recortar la combinación elegida a [min, max]
  // cuando se pasa de la raya, comparando la fecha completa (no solo el año).
  function posterior(a1, m1, d1, a2, m2, d2) {
    if (a1 !== a2) return a1 > a2
    if (m1 !== m2) return m1 > m2
    return d1 > d2
  }

  function elegir(nuevoAnio, nuevoMes, nuevoDia) {
    let a = nuevoAnio, m = nuevoMes, d = nuevoDia
    if (max && posterior(a, m, d, maxAnio, maxMes, maxDia)) {
      a = maxAnio; m = maxMes; d = maxDia
    } else if (min && posterior(minAnio, minMes, minDia, a, m, d)) {
      a = minAnio; m = minMes; d = minDia
    }
    setAnio(a)
    setMes(m)
    setDia(d)
  }

  function confirmar() {
    const mm = String(mes).padStart(2, '0')
    const dd = String(dia).padStart(2, '0')
    onConfirm(`${anio}-${mm}-${dd}`)
  }

  return (
    <ModalShell width={400} titulo={titulo} onClose={onClose}>
      <div className="flex" style={{ gap: 6 }}>
        <WheelPicker items={DIAS_ITEMS} value={dia} onChange={(v) => elegir(anio, mes, v)} />
        <WheelPicker items={MESES_ITEMS} value={mes} onChange={(v) => elegir(anio, v, dia)} />
        <WheelPicker items={ANIOS_ITEMS} value={anio} onChange={(v) => elegir(v, mes, dia)} />
      </div>

      <div className="flex" style={{ gap: 12, marginTop: 4 }}>
        <Button variant="secondary" size="md" onClick={onClose} style={{ flex: 1 }}>Cancelar</Button>
        <Button size="md" onClick={confirmar} style={{ flex: 1 }}>Aceptar</Button>
      </div>
    </ModalShell>
  )
}
