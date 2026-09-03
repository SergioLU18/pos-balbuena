import { f } from '../../lib/utils'
import { Chip } from '../ui/Chip'
import { chipGrid } from '../ui/chipStyles'

export function TierPicker({ tiers, selectedIndex, onSelect }) {
  return (
    <div style={chipGrid}>
      {tiers.map((tier, i) => (
        <Chip key={tier.nombre} active={i === selectedIndex} onClick={() => onSelect(i)} sublabel={f(tier.precio)}>
          {tier.nombre}
        </Chip>
      ))}
    </div>
  )
}
