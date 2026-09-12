import { useState } from 'react'
import { formatearTelefono } from '../../lib/telefono'
import { formatearCumpleanos } from '../../lib/cliente'
import { Button } from '../ui/Button'
import { FechaNacimientoModal } from './FechaNacimientoModal'

const ALTO_CAMPO = 52

const campo = {
  width: '100%', height: ALTO_CAMPO, fontFamily: "'Inter Tight', sans-serif", fontSize: 17, fontWeight: 600,
  padding: '0 16px', borderRadius: 14, border: '2.5px solid var(--jb-line)',
  background: '#fff', color: 'var(--jb-ink)', boxSizing: 'border-box',
}

// Igual alto que `campo` (el box de Cumpleaños) y el mismo ancho entre sí (flex: 1),
// para que la fila quede pareja.
function GeneroBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, height: ALTO_CAMPO, fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 800,
        borderRadius: 14, cursor: 'pointer', boxSizing: 'border-box',
        border: active ? '2.5px solid var(--jb-pink)' : '2.5px solid var(--jb-line)',
        background: active ? 'var(--jb-pink-tint)' : '#fff',
        color: active ? 'var(--jb-pink-dark)' : 'var(--jb-ink)',
      }}
    >
      {children}
    </button>
  )
}

/** Ficha del cliente: alta de uno nuevo y edición de uno existente (mismo formulario,
 *  porque los datos son los mismos y el mesero corrige la dirección con la misma
 *  frecuencia con la que da de alta).
 *
 *  El teléfono NO es editable aquí: es la llave con la que se encontró al cliente. Para
 *  un número distinto se busca ese número, que es lo que evita que "corregir el teléfono"
 *  se convierta sin querer en pisarle la ficha a otra persona.
 *
 *  La dirección va en columnas separadas (calle/número/cruzamientos/colonia/CP) y es
 *  obligatoria salvo `cruzamientos` — no siempre se conoce, y no debe bloquear el alta
 *  por eso. Cumpleaños y género son enteramente opcionales. */
export function ClienteForm({
  telefono, cliente, guardando, onGuardar, onCancelar,
  subtituloAlta, labelGuardarAlta = 'Registrar y tomar orden',
}) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [apellidos, setApellidos] = useState(cliente?.apellidos ?? '')
  const [calle, setCalle] = useState(cliente?.calle ?? '')
  const [numero, setNumero] = useState(cliente?.numero ?? '')
  const [cruzamientos, setCruzamientos] = useState(cliente?.cruzamientos ?? '')
  const [colonia, setColonia] = useState(cliente?.colonia ?? '')
  const [codigoPostal, setCodigoPostal] = useState(cliente?.codigoPostal ?? '')
  const [cumpleanos, setCumpleanos] = useState(cliente?.cumpleanos ?? '')
  const [genero, setGenero] = useState(cliente?.genero ?? '')
  const [nota, setNota] = useState(cliente?.nota ?? '')
  const [mostrandoFecha, setMostrandoFecha] = useState(false)

  const puedeGuardar = nombre.trim().length > 0 && apellidos.trim().length > 0
    && calle.trim().length > 0 && numero.trim().length > 0
    && colonia.trim().length > 0 && codigoPostal.length === 5
    && !guardando

  function guardar() {
    if (!puedeGuardar) return
    onGuardar({
      id: cliente?.id, telefono, nombre, apellidos,
      calle, numero, cruzamientos, colonia, codigoPostal,
      cumpleanos: cumpleanos || null, genero: genero || null, nota,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>
          {cliente ? 'Editar datos del cliente' : 'Cliente nuevo'}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--jb-ink-soft)' }}>
          {cliente
            ? 'Los cambios aplican a las órdenes nuevas; las anteriores conservan los datos con los que se mandaron.'
            : subtituloAlta ?? `El ${formatearTelefono(telefono)} no está registrado. Da de alta al cliente para tomarle la orden.`}
        </p>
      </div>

      <div className="flex" style={{ gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={etiqueta}>Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" autoFocus style={campo} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={etiqueta}>Apellidos</label>
          <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Apellidos" style={campo} />
        </div>
      </div>

      <div>
        <label style={etiqueta}>Dirección</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="flex" style={{ gap: 10 }}>
            <input value={calle} onChange={(e) => setCalle(e.target.value)} placeholder="Calle" style={{ ...campo, flex: 2 }} />
            <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Número" style={{ ...campo, flex: 1 }} />
          </div>
          <input
            value={cruzamientos}
            onChange={(e) => setCruzamientos(e.target.value)}
            placeholder="Cruzamientos (opcional)"
            style={campo}
          />
          <div className="flex" style={{ gap: 10 }}>
            <input value={colonia} onChange={(e) => setColonia(e.target.value)} placeholder="Colonia" style={{ ...campo, flex: 2 }} />
            <input
              value={codigoPostal}
              onChange={(e) => setCodigoPostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric"
              maxLength={5}
              placeholder="C.P."
              style={{ ...campo, flex: 1 }}
            />
          </div>
        </div>
      </div>

      <div className="flex" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={etiqueta}>Cumpleaños <span style={{ fontWeight: 600, color: 'var(--jb-gray)' }}>(opcional)</span></label>
          <button
            type="button"
            onClick={() => setMostrandoFecha(true)}
            style={{ ...campo, textAlign: 'left', cursor: 'pointer', color: cumpleanos ? 'var(--jb-ink)' : 'var(--jb-gray)' }}
          >
            {cumpleanos ? formatearCumpleanos(cumpleanos) : 'Seleccionar fecha'}
          </button>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={etiqueta}>Género <span style={{ fontWeight: 600, color: 'var(--jb-gray)' }}>(opcional)</span></label>
          <div className="flex" style={{ gap: 8 }}>
            <GeneroBtn active={genero === 'hombre'} onClick={() => setGenero(genero === 'hombre' ? '' : 'hombre')}>Hombre</GeneroBtn>
            <GeneroBtn active={genero === 'mujer'} onClick={() => setGenero(genero === 'mujer' ? '' : 'mujer')}>Mujer</GeneroBtn>
          </div>
        </div>
      </div>

      <div>
        <label style={etiqueta}>Nota <span style={{ fontWeight: 600, color: 'var(--jb-gray)' }}>(opcional)</span></label>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Referencias, alergias, cómo le gusta"
          style={campo}
        />
      </div>

      <div className="flex" style={{ gap: 12, marginTop: 4 }}>
        {onCancelar && (
          <Button variant="secondary" size="md" onClick={onCancelar} style={{ flex: 1 }}>
            Cancelar
          </Button>
        )}
        <Button size="md" onClick={guardar} disabled={!puedeGuardar} style={{ flex: 2 }}>
          {guardando ? 'Guardando…' : cliente ? 'Guardar cambios' : labelGuardarAlta}
        </Button>
      </div>

      {mostrandoFecha && (
        <FechaNacimientoModal
          value={cumpleanos || null}
          onConfirm={(iso) => { setCumpleanos(iso); setMostrandoFecha(false) }}
          onQuitar={() => { setCumpleanos(''); setMostrandoFecha(false) }}
          onClose={() => setMostrandoFecha(false)}
        />
      )}
    </div>
  )
}

const etiqueta = { display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 800, color: 'var(--jb-ink-soft)' }
