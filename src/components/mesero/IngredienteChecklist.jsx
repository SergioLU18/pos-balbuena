import { f } from '../../lib/utils'
import { Chip } from '../ui/Chip'
import { chipGrid } from '../ui/chipStyles'

/** Selección de ingredientes con tope = max (nivel del platillo elegido), mostrada como
 *  lugares: un sope de 2 ingredientes tiene 2 lugares arriba del catálogo.
 *  Cada acción tiene un solo significado:
 *  - Tocar un ingrediente del catálogo siempre AGREGA una unidad en el siguiente lugar
 *    vacío. El mismo ingrediente puede ocupar varios lugares (p. ej. "doble asado").
 *  - Tocar un lugar ocupado lo QUITA, solo esa unidad (×2 → ×1).
 *  - Con todos los lugares llenos el catálogo se apaga: para cambiar hay que quitar uno
 *    primero, en vez de reemplazar en silencio al más antiguo. */
export function IngredienteChecklist({ ingredientes, seleccionados, max, onChange, resaltarFalta = false }) {
  const falta = max - seleccionados.length
  const incompleto = resaltarFalta && falta > 0
  const atMax = seleccionados.length >= max

  function agregar(nombre) {
    if (atMax) return
    onChange([...seleccionados, nombre])
  }

  function quitar(i) {
    onChange(seleccionados.filter((_, j) => j !== i))
  }

  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 800, color: incompleto ? '#C24A4A' : 'var(--jb-ink-soft)', margin: '0 0 10px' }}>
        Ingredientes ({seleccionados.length}/{max})
        {incompleto ? ` · falta${falta > 1 ? 'n' : ''} ${falta}` : ''}
        {atMax ? ' · toca uno elegido para quitarlo' : ''}
      </p>

      <div style={{ ...chipGrid, marginBottom: 14 }}>
        {Array.from({ length: max }, (_, i) =>
          i < seleccionados.length ? (
            <Chip key={i} active sublabel="quitar" onClick={() => quitar(i)}>
              {seleccionados[i]} ✕
            </Chip>
          ) : (
            <LugarVacio key={i} numero={i + 1} />
          ),
        )}
      </div>

      <div style={chipGrid}>
        {ingredientes.map((ing) => {
          const cantidad = seleccionados.filter((n) => n === ing.nombre).length
          return (
            <Chip
              key={ing.nombre}
              active={cantidad > 0}
              disabled={atMax}
              sublabel={ing.extra > 0 ? `+${f(ing.extra)}` : undefined}
              badge={cantidad >= 2 ? `×${cantidad}` : undefined}
              onClick={() => agregar(ing.nombre)}
            >
              {ing.nombre}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}

/** Lugar todavía sin ingrediente: mismo tamaño que un Chip, borde punteado, no tocable. */
function LugarVacio({ numero }) {
  return (
    <div
      style={{
        fontFamily: "'Inter Tight', sans-serif",
        fontSize: 17,
        fontWeight: 700,
        color: 'var(--jb-gray)',
        border: '3px dashed var(--jb-line)',
        borderRadius: 16,
        minHeight: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Ingrediente {numero}
    </div>
  )
}
