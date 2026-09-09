import { Chip } from '../ui/Chip'
import { chipGrid } from '../ui/chipStyles'

/** Modificadores de remoción (Sin Crema, Sin Frijol, ...) — selección libre, sin tope. */
export function ModificadorToggles({ modificadores, seleccionados, onChange }) {
  function toggle(nombre) {
    onChange(
      seleccionados.includes(nombre) ? seleccionados.filter((n) => n !== nombre) : [...seleccionados, nombre],
    )
  }

  if (!modificadores.length) return null

  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--jb-ink-soft)', margin: '0 0 10px' }}>Personaliza</p>
      <div style={chipGrid}>
        {modificadores.map((mod) => (
          <Chip key={mod} active={seleccionados.includes(mod)} onClick={() => toggle(mod)}>
            {mod}
          </Chip>
        ))}
      </div>
    </div>
  )
}
