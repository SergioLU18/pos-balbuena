import { f } from '../../lib/utils'
import { Chip } from '../ui/Chip'
import { chipGrid } from '../ui/chipStyles'

/** Extras de pago (Aguacate +$30, Crema +$10, …) — selección libre, sin tope, a nivel
 *  platillo. `seleccionados` es un arreglo de { nombre, precio } (el precio se guarda en
 *  el renglón para que el total no dependa del catálogo). */
export function ExtrasToggles({ extras, seleccionados, onChange }) {
  const nombresSel = seleccionados.map((e) => e.nombre)

  function toggle(ex) {
    onChange(
      nombresSel.includes(ex.nombre)
        ? seleccionados.filter((e) => e.nombre !== ex.nombre)
        : [...seleccionados, { nombre: ex.nombre, precio: ex.precio }],
    )
  }

  if (!extras.length) return null

  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--jb-ink-soft)', margin: '0 0 10px' }}>Extras</p>
      <div style={chipGrid}>
        {extras.map((ex) => (
          <Chip
            key={ex.nombre}
            active={nombresSel.includes(ex.nombre)}
            onClick={() => toggle(ex)}
            sublabel={ex.precio > 0 ? `+${f(ex.precio)}` : undefined}
          >
            {ex.nombre}
          </Chip>
        ))}
      </div>
    </div>
  )
}
