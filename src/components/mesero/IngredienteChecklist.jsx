import { f } from '../../lib/utils'
import { Chip } from '../ui/Chip'
import { chipGrid } from '../ui/chipStyles'

/** Selección múltiple de ingredientes con tope = max (nivel del platillo elegido).
 *  Al llegar al tope, elegir otro ingrediente reemplaza al más antiguo en vez de
 *  ignorar el clic. */
export function IngredienteChecklist({ ingredientes, seleccionados, max, onChange, resaltarFalta = false }) {
  const falta = max - seleccionados.length
  const incompleto = resaltarFalta && falta > 0
  function toggle(nombre) {
    if (seleccionados.includes(nombre)) {
      onChange(seleccionados.filter((n) => n !== nombre))
      return
    }
    if (seleccionados.length < max) {
      onChange([...seleccionados, nombre])
    } else {
      // Ya está en el tope: saca el más antiguo y mete el nuevo.
      onChange([...seleccionados.slice(1), nombre])
    }
  }

  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 800, color: incompleto ? '#C24A4A' : 'var(--jb-ink-soft)', margin: '0 0 10px' }}>
        Ingredientes ({seleccionados.length}/{max})
        {incompleto ? ` · falta${falta > 1 ? 'n' : ''} ${falta}` : ''}
      </p>
      <div style={chipGrid}>
        {ingredientes.map((ing) => {
          const active = seleccionados.includes(ing.nombre)
          const atMax = seleccionados.length >= max
          return (
            <Chip
              key={ing.nombre}
              active={active}
              dimmed={atMax}
              sublabel={ing.extra > 0 ? `+${f(ing.extra)}` : undefined}
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
