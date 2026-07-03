import { f } from '../../lib/utils'
import { Chip } from '../ui/Chip'

export function TierPicker({ tiers, selectedIndex, onSelect }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {tiers.map((tier, i) => (
        <Chip key={tier.nombre} active={i === selectedIndex} onClick={() => onSelect(i)} sublabel={f(tier.precio)}>
          {tier.nombre}
        </Chip>
      ))}
    </div>
  )
}
