import { useState } from 'react'
import { formatearTelefono } from '../../lib/telefono'
import { Button } from '../ui/Button'

const campo = {
  width: '100%', fontFamily: "'Inter Tight', sans-serif", fontSize: 17, fontWeight: 600,
  padding: '14px 16px', borderRadius: 14, border: '2.5px solid var(--jb-line)',
  background: '#fff', color: 'var(--jb-ink)',
}

/** Ficha del cliente: alta de uno nuevo y edición de uno existente (mismo formulario,
 *  porque los datos son los mismos y el mesero corrige la dirección con la misma
 *  frecuencia con la que da de alta).
 *
 *  El teléfono NO es editable aquí: es la llave con la que se encontró al cliente. Para
 *  un número distinto se busca ese número, que es lo que evita que "corregir el teléfono"
 *  se convierta sin querer en pisarle la ficha a otra persona. */
export function ClienteForm({ telefono, cliente, guardando, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [direccion, setDireccion] = useState(cliente?.direccion ?? '')
  const [nota, setNota] = useState(cliente?.nota ?? '')

  const puedeGuardar = nombre.trim().length > 0 && !guardando

  function guardar() {
    if (!puedeGuardar) return
    onGuardar({ id: cliente?.id, telefono, nombre, direccion, nota })
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
            : `El ${formatearTelefono(telefono)} no está registrado. Da de alta al cliente para tomarle la orden.`}
        </p>
      </div>

      <div>
        <label style={etiqueta}>Nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de quien recoge"
          autoFocus
          style={campo}
        />
      </div>

      <div>
        <label style={etiqueta}>Dirección <span style={{ fontWeight: 600, color: 'var(--jb-gray)' }}>(opcional)</span></label>
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Calle, número, colonia"
          style={campo}
        />
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
          {guardando ? 'Guardando…' : cliente ? 'Guardar cambios' : 'Registrar y tomar orden'}
        </Button>
      </div>
    </div>
  )
}

const etiqueta = { display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 800, color: 'var(--jb-ink-soft)' }
