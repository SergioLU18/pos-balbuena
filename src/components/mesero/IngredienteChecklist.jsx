import { f } from '../../lib/utils'
import { Chip } from '../ui/Chip'

/** Selección múltiple de ingredientes con tope = max (nivel del platillo elegido). */
export function IngredienteChecklist({ ingredientes, seleccionados, max, onChange }) {
  function toggle(nombre) {
    const yaElegido = seleccionados.includes(nombre)
    if (yaElegido) {
      onChange(seleccionados.filter((n) => n !== nombre))
    } else if (seleccionados.length < max) {
      onChange([...seleccionados, nombre])
    }
  }

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)', margin: '0 0 8px' }}>
        Ingredientes ({seleccionados.length}/{max})
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ingredientes.map((ing) => {
          const active = seleccionados.includes(ing.nombre)
          const atMax = seleccionados.length >= max
          return (
            <Chip key={ing.nombre} active={active} disabled={atMax} onClick={() => toggle(ing.nombre)}>
              {ing.nombre}
              {ing.extra > 0 ? ` +${f(ing.extra)}` : ''}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}
