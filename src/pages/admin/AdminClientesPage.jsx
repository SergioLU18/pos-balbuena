import { useMemo, useState } from 'react'
import { useLlevar } from '../../hooks/useLlevar'
import { formatearTelefono, normalizarTelefono, telefonoCompleto } from '../../lib/telefono'
import { nombreCompleto, formatearDireccion, formatearCumpleanos, formatearGenero } from '../../lib/cliente'
import { ModalShell, Campo } from '../../components/admin/AdminModal'
import { inputStyle } from '../../components/admin/adminStyles'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { ClienteForm } from '../../components/mesero/ClienteForm'
import { HistorialCliente } from '../../components/mesero/HistorialCliente'
import { TelefonoPad } from '../../components/mesero/TelefonoPad'

// Ajustes → Clientes: el padrón que se va formando solo, cliente por cliente, cada vez
// que un mesero toma un pedido para llevar (ver ClienteForm / useLlevar). También se
// puede dar de alta uno desde aquí ("+ Nuevo cliente"), con el mismo formulario y el
// mismo teclado de teléfono que usa el mesero — útil para cargar el padrón de un jalón
// sin depender de que llegue un pedido.
export default function AdminClientesPage() {
  const { clientes, buscarPorTelefono, guardarCliente, borrarCliente, historialCliente } = useLlevar()
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [historial, setHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [agregando, setAgregando] = useState(false)

  // El historial se pide al abrir la ficha, no desde un efecto: mismo criterio que
  // LlevarPage.jsx — encontrar al cliente ES el momento en que hay historial que pedir.
  async function abrir(cliente) {
    setSeleccionado(cliente)
    setHistorial([])
    setCargandoHistorial(true)
    const { historial: h } = await historialCliente(cliente.id)
    setHistorial(h)
    setCargandoHistorial(false)
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const qDigitos = normalizarTelefono(busqueda)
    const base = !q
      ? clientes
      : clientes.filter((c) => nombreCompleto(c).toLowerCase().includes(q) || (qDigitos && c.telefono.includes(qDigitos)))
    return base.slice().sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)))
  }, [clientes, busqueda])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 24px 60px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--jb-ink-soft)' }}>
          {clientes.length} {clientes.length === 1 ? 'cliente registrado' : 'clientes registrados'} desde pedidos para llevar
        </p>
        <div className="flex items-center" style={{ gap: 10 }}>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o teléfono"
            style={{ ...inputStyle, width: 260 }}
          />
          <Button size="md" onClick={() => setAgregando(true)}>+ Nuevo cliente</Button>
        </div>
      </div>

      {clientes.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--jb-gray)' }}>
          Todavía no hay clientes. Se registran solos cuando un mesero toma un pedido para llevar.
        </p>
      ) : filtrados.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--jb-gray)' }}>Sin resultados para "{busqueda}".</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map((c) => (
            <button key={c.id} onClick={() => abrir(c)} style={filaBtn}>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--jb-ink)' }}>{nombreCompleto(c)}</span>
                <span style={{ fontSize: 13, color: 'var(--jb-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatearDireccion(c)}
                </span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--jb-pink-dark)', flexShrink: 0 }}>
                {formatearTelefono(c.telefono)}
              </span>
            </button>
          ))}
        </div>
      )}

      {seleccionado && (
        <ClienteModal
          cliente={seleccionado}
          historial={historial}
          cargandoHistorial={cargandoHistorial}
          onGuardar={guardarCliente}
          onBorrar={borrarCliente}
          onClose={() => setSeleccionado(null)}
        />
      )}

      {agregando && (
        <NuevoClienteModal
          onBuscarPorTelefono={buscarPorTelefono}
          onGuardar={guardarCliente}
          onExistente={(cliente) => { setAgregando(false); abrir(cliente) }}
          onClose={() => setAgregando(false)}
        />
      )}
    </div>
  )
}

// Alta desde Ajustes: primero el teléfono (mismo teclado que usa el mesero), y si ya
// existe un cliente con ese número se manda directo a su ficha en vez de duplicarlo —
// el teléfono sigue siendo la llave del padrón, también dándolo de alta desde aquí.
function NuevoClienteModal({ onBuscarPorTelefono, onGuardar, onExistente, onClose }) {
  const [telefono, setTelefono] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  // Teléfono completo y sin coincidencia en el padrón: pasa al formulario de alta.
  const [mostrarForm, setMostrarForm] = useState(false)

  async function buscarYContinuar() {
    if (!telefonoCompleto(telefono)) return
    setBuscando(true)
    setError(null)
    const { cliente, error: err } = await onBuscarPorTelefono(telefono)
    setBuscando(false)
    if (err) { setError(err); return }
    if (cliente) { onExistente(cliente); return }
    setMostrarForm(true)
  }

  async function guardar(datos) {
    setGuardando(true)
    setError(null)
    const { error: err } = await onGuardar(datos)
    setGuardando(false)
    if (err) { setError(err); return }
    onClose()
  }

  return (
    <ModalShell width={420} titulo="Nuevo cliente" onClose={onClose}>
      {mostrarForm ? (
        <ClienteForm
          telefono={telefono}
          guardando={guardando}
          onGuardar={guardar}
          onCancelar={onClose}
          subtituloAlta={`El ${formatearTelefono(telefono)} no está registrado. Da de alta su ficha.`}
          labelGuardarAlta="Registrar cliente"
        />
      ) : (
        <TelefonoPad
          valor={telefono}
          onDigito={(d) => { setError(null); setTelefono((t) => (t.length >= 10 ? t : t + d)) }}
          onBorrar={() => { setError(null); setTelefono((t) => t.slice(0, -1)) }}
          onLimpiar={() => { setError(null); setTelefono('') }}
          onBuscar={buscarYContinuar}
          buscando={buscando}
          error={error}
        />
      )}
      {error && mostrarForm && <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#C24A4A' }}>{error}</p>}
    </ModalShell>
  )
}

// Al abrir, la ficha se ve pero no se puede tocar por accidente: hay que tocar
// "Editar" a propósito para que los campos se vuelvan escribibles. El botón de
// borrar solo aparece en modo edición, separado y con su propio color, y pide
// confirmación — igual que "Borrar platillo" en Ajustes → Menú.
function ClienteModal({ cliente, historial, cargandoHistorial, onGuardar, onBorrar, onClose }) {
  const [datos, setDatos] = useState(cliente)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [borrando, setBorrando] = useState(false)

  async function guardar(nuevosDatos) {
    setGuardando(true)
    setError(null)
    const { cliente: guardado, error: err } = await onGuardar(nuevosDatos)
    setGuardando(false)
    if (err) { setError(err); return }
    setDatos(guardado ?? { ...datos, ...nuevosDatos })
    setEditando(false)
  }

  async function confirmarBorrado() {
    setBorrando(false)
    const { error: err } = await onBorrar(datos.id)
    if (err) { setError(err); return }
    onClose()
  }

  return (
    <ModalShell width={560} titulo={nombreCompleto(datos)} onClose={onClose}>
      {editando ? (
        <>
          <ClienteForm
            telefono={datos.telefono}
            cliente={datos}
            guardando={guardando}
            onGuardar={guardar}
            onCancelar={() => { setError(null); setEditando(false) }}
          />
          <button onClick={() => setBorrando(true)} style={borrarBtn}>Borrar cliente</button>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Campo label="Teléfono">
            <div style={valorLeer}>{formatearTelefono(datos.telefono)}</div>
          </Campo>
          <Campo label="Dirección">
            <div style={valorLeer}>{formatearDireccion(datos) || '—'}</div>
          </Campo>
          <div className="flex" style={{ gap: 14 }}>
            <div style={{ flex: 1 }}>
              <Campo label="Cumpleaños">
                <div style={valorLeer}>{formatearCumpleanos(datos.cumpleanos) || '—'}</div>
              </Campo>
            </div>
            <div style={{ flex: 1 }}>
              <Campo label="Género">
                <div style={valorLeer}>{formatearGenero(datos.genero) || '—'}</div>
              </Campo>
            </div>
          </div>
          <Campo label="Nota">
            <div style={valorLeer}>{datos.nota || '—'}</div>
          </Campo>
          <Button size="md" onClick={() => setEditando(true)}>Editar datos</Button>
        </div>
      )}

      {error && <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#C24A4A' }}>{error}</p>}

      <div style={{ borderTop: '1.5px dashed var(--jb-line)', paddingTop: 14 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: 'var(--jb-pink-dark)' }}>Historial de pedidos</h3>
        <HistorialCliente historial={historial} cargando={cargandoHistorial} />
      </div>

      {borrando && (
        <ConfirmModal
          titulo={`¿Borrar a ${nombreCompleto(datos)}?`}
          mensaje="Deja de aparecer en el padrón. Sus pedidos anteriores conservan su historial."
          confirmarLabel="Borrar cliente"
          danger
          onConfirm={confirmarBorrado}
          onClose={() => setBorrando(false)}
        />
      )}
    </ModalShell>
  )
}

const valorLeer = {
  border: '2px solid var(--jb-line)', borderRadius: 12, padding: '11px 14px',
  fontSize: 15, color: 'var(--jb-ink)', background: 'var(--jb-cream)',
}

// Separado del Cancelar/Guardar y con su propio color, para que no se apriete de
// pasada — mismo criterio que el botón "Borrar platillo" en Ajustes → Menú.
const borrarBtn = {
  width: '100%', border: '2px solid #E6C2C2', borderRadius: 14, padding: '12px 0', minHeight: 48,
  marginTop: 10, fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 800,
  cursor: 'pointer', background: '#F6E7E7', color: '#C24A4A',
}

const filaBtn = {
  width: '100%', textAlign: 'left', cursor: 'pointer', background: '#fff',
  border: '2.5px solid var(--jb-line)', borderRadius: 14,
  padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  fontFamily: "'Inter Tight', sans-serif",
}
