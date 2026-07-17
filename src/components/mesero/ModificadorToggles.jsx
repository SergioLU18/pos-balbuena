import { Chip } from '../ui/Chip'

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
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)', margin: '0 0 8px' }}>Personaliza</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {modificadores.map((mod) => (
          <Chip key={mod} active={seleccionados.includes(mod)} onClick={() => toggle(mod)}>
            {mod}
          </Chip>
        ))}
      </div>
    </div>
  )
}
