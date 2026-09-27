import { f } from '../../lib/utils'
import { Chip } from '../ui/Chip'
import { chipGrid } from '../ui/chipStyles'

/** Selección múltiple de ingredientes con tope = max (nivel del platillo elegido).
 *  El mismo ingrediente se puede elegir más de una vez (p. ej. "doble asado"): mientras
 *  quede espacio, tocarlo otra vez agrega una unidad más en vez de quitarlo. Ya en el
 *  tope, tocar un ingrediente ya elegido lo quita por completo — el mismo proceso que
 *  libera un lugar cuando los dos elegidos son distintos —, y tocar uno nuevo reemplaza
 *  al más antiguo en vez de ignorar el clic. */
export function IngredienteChecklist({ ingredientes, seleccionados, max, onChange, resaltarFalta = false }) {
  const falta = max - seleccionados.length
  const incompleto = resaltarFalta && falta > 0
  const atMax = seleccionados.length >= max

  function toggle(nombre) {
    if (atMax) {
      if (seleccionados.includes(nombre)) {
        onChange(seleccionados.filter((n) => n !== nombre))
      } else {
        onChange([...seleccionados.slice(1), nombre])
      }
      return
    }
    onChange([...seleccionados, nombre])
  }

  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 800, color: incompleto ? '#C24A4A' : 'var(--jb-ink-soft)', margin: '0 0 10px' }}>
        Ingredientes ({seleccionados.length}/{max})
        {incompleto ? ` · falta${falta > 1 ? 'n' : ''} ${falta}` : ''}
      </p>
      <div style={chipGrid}>
        {ingredientes.map((ing) => {
          const cantidad = seleccionados.filter((n) => n === ing.nombre).length
          return (
            <Chip
              key={ing.nombre}
              active={cantidad > 0}
              dimmed={atMax}
              sublabel={ing.extra > 0 ? `+${f(ing.extra)}` : undefined}
              badge={cantidad >= 2 ? `×${cantidad}` : undefined}
              onClick={() => toggle(ing.nombre)}
            >
              {ing.nombre}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}
