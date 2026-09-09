import { useState } from 'react'
import { f } from '../../lib/utils'
import { Chip } from '../ui/Chip'
import { chipGrid } from '../ui/chipStyles'

/** Extras de pago a nivel platillo. `seleccionados` es un arreglo de { nombre, precio }
 *  (el precio se guarda en el renglón para que el total no dependa del catálogo).
 *
 *  Dos orígenes conviven en ese mismo arreglo:
 *   - Catálogo (Aguacate +$30, Crema +$10, …): los que el platillo declara; se prenden
 *     y apagan por nombre.
 *   - Libres (`libre: true`): lo que el mesero escribe en el momento — "un huevo",
 *     "doble carne" — con su precio. Se ofrecen en TODOS los platillos, porque el caso
 *     que resuelven es justamente el que nadie va a dar de alta en el catálogo. Se
 *     quitan por posición, no por nombre, para que dos libres homónimos con distinto
 *     precio no se estorben.
 */

const MAX_NOMBRE = 40

export function ExtrasToggles({ extras, seleccionados, onChange }) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')

  const estaEnCatalogo = (nom) => seleccionados.some((e) => !e.libre && e.nombre === nom)

  function toggle(ex) {
    onChange(
      estaEnCatalogo(ex.nombre)
        ? seleccionados.filter((e) => e.libre || e.nombre !== ex.nombre)
        : [...seleccionados, { nombre: ex.nombre, precio: ex.precio }],
    )
  }

  function quitarLibre(index) {
    onChange(seleccionados.filter((_, i) => i !== index))
  }

  // El precio tiene que venir escrito: en blanco NO vale $0. Un extra que se cobra mal
  // por un campo que se quedó vacío no se nota hasta la cuenta, y para el agregado que
  // de verdad no cuesta ya está "Sin X" (modificadores) o la nota.
  const nombreLimpio = nombre.trim().slice(0, MAX_NOMBRE)
  const precioNum = Number(precio)
  const puedeAgregar = nombreLimpio !== '' && precio.trim() !== '' && Number.isFinite(precioNum) && precioNum >= 0

  function agregarLibre() {
    if (!puedeAgregar) return
    onChange([...seleccionados, { nombre: nombreLimpio, precio: Math.round(precioNum * 100) / 100, libre: true }])
    setNombre('')
    setPrecio('')
  }

  const onEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarLibre() } }

  const inputStyle = {
    border: '2.5px solid var(--jb-line)', borderRadius: 14, padding: '13px 14px',
    fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 600, outline: 'none',
    color: 'var(--jb-ink)', background: '#fff', minWidth: 0,
  }

  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--jb-ink-soft)', margin: '0 0 10px' }}>Extras</p>

      {/* Los libres van en la MISMA rejilla que los del catálogo: son la misma clase de
          cosa para el mesero, y separarlos en dos filas de distinto ancho se leía como si
          fueran dos controles distintos. */}
      {(extras.length > 0 || seleccionados.length > 0) && (
        <div style={{ ...chipGrid, marginBottom: 12 }}>
          {extras.map((ex) => (
            <Chip
              key={ex.nombre}
              active={estaEnCatalogo(ex.nombre)}
              onClick={() => toggle(ex)}
              sublabel={ex.precio > 0 ? `+${f(ex.precio)}` : undefined}
            >
              {ex.nombre}
            </Chip>
          ))}
          {seleccionados.map((e, i) => e.libre && (
            <Chip
              key={`libre-${i}`}
              active
              onClick={() => quitarLibre(i)}
              sublabel={`+${f(e.precio)} · quitar`}
            >
              {e.nombre} ✕
            </Chip>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          value={nombre}
          onChange={(ev) => setNombre(ev.target.value)}
          onKeyDown={onEnter}
          maxLength={MAX_NOMBRE}
          placeholder="Otro extra (ej. un huevo)"
          aria-label="Otro extra"
          style={{ ...inputStyle, flex: 1 }}
        />
        <input
          value={precio}
          onChange={(ev) => setPrecio(ev.target.value)}
          onKeyDown={onEnter}
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          placeholder="$"
          aria-label="Precio del extra"
          style={{ ...inputStyle, width: 110 }}
        />
        <button
          type="button"
          onClick={agregarLibre}
          disabled={!puedeAgregar}
          style={{
            border: 'none', borderRadius: 14, padding: '0 20px',
            fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 800,
            background: puedeAgregar ? 'var(--jb-pink)' : 'var(--jb-line)',
            color: puedeAgregar ? '#fff' : 'var(--jb-gray)',
            cursor: puedeAgregar ? 'pointer' : 'not-allowed',
            minHeight: 52, whiteSpace: 'nowrap',
          }}
        >
          Agregar
        </button>
      </div>
    </div>
  )
}
