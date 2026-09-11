import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLlevar, totalDeOrden } from '../../hooks/useLlevar'
import { useVertical } from '../../hooks/useVertical'
import { formatearTelefono, telefonoCompleto } from '../../lib/telefono'
import { f, minutosTranscurridos } from '../../lib/utils'
import { TelefonoPad } from '../../components/mesero/TelefonoPad'
import { ClienteForm } from '../../components/mesero/ClienteForm'
import { HistorialCliente } from '../../components/mesero/HistorialCliente'
import { Button } from '../../components/ui/Button'

// Pasos del panel derecho. El teclado de la izquierda siempre está: se puede buscar otro
// número en cualquier momento sin tener que "salir" de lo que se esté viendo.
//   ordenes  — nada buscado todavía: las órdenes para llevar abiertas del turno
//   ficha    — el teléfono ya existe en el padrón: datos + historial + tomar orden
//   nuevo    — el teléfono no existe: alta del cliente
//   editar   — corrección de la ficha de un cliente que sí existe
const PASOS = { ordenes: 'ordenes', ficha: 'ficha', nuevo: 'nuevo', editar: 'editar' }

export default function LlevarPage() {
  const navigate = useNavigate()
  const vertical = useVertical()
  const { ordenesAbiertas, pedidos, buscarPorTelefono, guardarCliente, crearOrden, historialCliente } = useLlevar()

  const [telefono, setTelefono] = useState('')
  const [paso, setPaso] = useState(PASOS.ordenes)
  const [cliente, setCliente] = useState(null)
  const [historial, setHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)

  // El historial se pide por cliente y no viene con la búsqueda: es una consulta aparte
  // (y bajo demanda en backend) para no arrastrar el histórico completo a cada tablet.
  // Se dispara desde el evento que trae al cliente —la búsqueda o el guardado— y no
  // desde un efecto: encontrar al cliente ES el momento en que hay historial que pedir.
  async function cargarHistorial(clienteId) {
    setHistorial([])
    if (!clienteId) return
    setCargandoHistorial(true)
    const { historial: h } = await historialCliente(clienteId)
    setHistorial(h)
    setCargandoHistorial(false)
  }

  function tecla(d) {
    setError(null)
    setTelefono((t) => (t.length >= 10 ? t : t + d))
  }

  function limpiar() {
    setTelefono('')
    setCliente(null)
    setHistorial([])
    setPaso(PASOS.ordenes)
    setError(null)
  }

  async function buscar() {
    if (!telefonoCompleto(telefono)) return
    setOcupado(true)
    setError(null)
    const { cliente: encontrado, error: err } = await buscarPorTelefono(telefono)
    setOcupado(false)
    if (err) { setError(err); return }
    setCliente(encontrado)
    setPaso(encontrado ? PASOS.ficha : PASOS.nuevo)
    cargarHistorial(encontrado?.id)
  }

  // Alta: guardar la ficha y arrancar la orden de una vez — el mesero llegó aquí porque
  // el cliente ya está pidiendo, no para administrar un padrón.
  async function registrarYTomarOrden(datos) {
    setOcupado(true)
    setError(null)
    const { cliente: guardado, error: err } = await guardarCliente(datos)
    if (err) { setOcupado(false); setError(err); return }
    await abrirOrden(guardado)
  }

  // Edición: solo guarda y vuelve a la ficha.
  async function guardarEdicion(datos) {
    setOcupado(true)
    setError(null)
    const { cliente: guardado, error: err } = await guardarCliente(datos)
    setOcupado(false)
    if (err) { setError(err); return }
    setCliente(guardado)
    setPaso(PASOS.ficha)
  }

  async function abrirOrden(delCliente) {
    setOcupado(true)
    setError(null)
    const { ordenId, error: err } = await crearOrden(delCliente)
    setOcupado(false)
    if (err) { setError(err); return }
    navigate(`/mesero/llevar/orden/${ordenId}`)
  }

  return (
    <div className="h-full flex flex-col" style={{ padding: vertical ? '20px 20px' : '24px 32px' }}>
      <div className="flex items-center flex-shrink-0" style={{ gap: 14, marginBottom: 20 }}>
        <button onClick={() => navigate('/mesero')} aria-label="Volver a mesas" style={botonAtras}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--jb-ink)' }}>Para llevar</h1>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--jb-ink-soft)' }}>
            Busca al cliente por su teléfono para tomarle la orden
          </p>
        </div>
      </div>

      {/* En vertical el teclado se angosta (sigue a un lado, no arriba: apilado, las
          teclas quedarían enormes y el panel del cliente se iría hasta abajo) para que
          el formulario y la ficha conserven un ancho cómodo. */}
      <div
        className="flex-1 min-h-0"
        style={{ display: 'grid', gridTemplateColumns: vertical ? '300px minmax(0, 1fr)' : '360px minmax(0, 1fr)', gap: vertical ? 20 : 24 }}
      >
        <div className="no-scrollbar" style={{ overflowY: 'auto' }}>
          <TelefonoPad
            valor={telefono}
            onDigito={tecla}
            onBorrar={() => { setError(null); setTelefono((t) => t.slice(0, -1)) }}
            onLimpiar={limpiar}
            onBuscar={buscar}
            buscando={ocupado && paso === PASOS.ordenes}
            error={paso === PASOS.ordenes ? error : null}
          />
        </div>

        <div
          className="no-scrollbar"
          style={{
            overflowY: 'auto', background: '#fff', border: '2.5px solid var(--jb-line)',
            borderRadius: 24, padding: '22px 24px',
          }}
        >
          {paso === PASOS.ordenes && (
            <OrdenesAbiertas
              ordenes={ordenesAbiertas}
              pedidos={pedidos}
              onAbrir={(o) => navigate(`/mesero/llevar/orden/${o.id}`)}
            />
          )}

          {paso === PASOS.nuevo && (
            <ClienteForm
              telefono={telefono}
              guardando={ocupado}
              onGuardar={registrarYTomarOrden}
              onCancelar={limpiar}
            />
          )}

          {paso === PASOS.editar && (
            <ClienteForm
              telefono={telefono}
              cliente={cliente}
              guardando={ocupado}
              onGuardar={guardarEdicion}
              onCancelar={() => setPaso(PASOS.ficha)}
            />
          )}

          {paso === PASOS.ficha && cliente && (
            <FichaCliente
              cliente={cliente}
              historial={historial}
              cargandoHistorial={cargandoHistorial}
              ocupado={ocupado}
              onTomarOrden={() => abrirOrden(cliente)}
              onEditar={() => setPaso(PASOS.editar)}
            />
          )}

          {error && paso !== PASOS.ordenes && (
            <p style={{ margin: '14px 0 0', fontSize: 14, fontWeight: 700, color: '#C24A4A' }}>{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function FichaCliente({ cliente, historial, cargandoHistorial, ocupado, onTomarOrden, onEditar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex items-start justify-between" style={{ gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--jb-pink-dark)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Cliente registrado
          </span>
          <h2 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 900, color: 'var(--jb-ink)' }}>{cliente.nombre}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 16, color: 'var(--jb-ink-soft)' }}>
            {formatearTelefono(cliente.telefono)}
          </p>
          {cliente.direccion && (
            <p style={{ margin: '4px 0 0', fontSize: 16, color: 'var(--jb-ink-soft)' }}>{cliente.direccion}</p>
          )}
          {cliente.nota && (
            <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--jb-pink-dark)' }}>“{cliente.nota}”</p>
          )}
        </div>
        <button onClick={onEditar} style={botonSecundario}>Editar datos</button>
      </div>

      <Button onClick={onTomarOrden} disabled={ocupado} style={{ width: '100%' }}>
        {ocupado ? 'Abriendo orden…' : 'Nueva orden para llevar'}
      </Button>

      <div>
        <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 900, color: 'var(--jb-ink)' }}>
          Historial de compras
        </h3>
        <HistorialCliente historial={historial} cargando={cargandoHistorial} />
      </div>
    </div>
  )
}

function OrdenesAbiertas({ ordenes, pedidos, onAbrir }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 900, color: 'var(--jb-ink)' }}>
        Órdenes para llevar abiertas
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--jb-ink-soft)' }}>
        Las que siguen sin entregarse. Tócalas para agregar platillos o cerrarlas.
      </p>

      {ordenes.length === 0 ? (
        <p style={{ margin: '28px 0', textAlign: 'center', fontSize: 15, color: 'var(--jb-gray)' }}>
          No hay órdenes para llevar abiertas.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {ordenes.map((orden) => {
            const suyos = pedidos.filter((p) => p.ordenLlevarId === orden.id)
            const listo = suyos.some((p) => p.estado === 'listo')
            const cocinando = suyos.some((p) => p.estado === 'preparando')
            const estado = listo
              ? { texto: '¡Listo para entregar!', color: '#1B5E66', fondo: 'var(--jb-teal-bg)', borde: 'var(--jb-teal)' }
              : cocinando
              ? { texto: 'En preparación', color: '#2C5F86', fondo: 'var(--jb-info-bg)', borde: 'var(--jb-info)' }
              : suyos.length > 0
              ? { texto: 'Pedido enviado', color: '#A8471F', fondo: 'var(--jb-queued-bg)', borde: 'var(--jb-queued)' }
              : { texto: 'Sin platillos', color: 'var(--jb-gray)', fondo: '#fff', borde: 'var(--jb-line)' }

            return (
              <button
                key={orden.id}
                onClick={() => onAbrir(orden)}
                className="jb-fade-up"
                style={{
                  background: estado.fondo, border: `2.5px solid ${estado.borde}`, borderRadius: 18,
                  padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                  fontFamily: "'Inter Tight', sans-serif", display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                <span className="flex items-center justify-between" style={{ gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--jb-ink)' }}>L-{orden.folio}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--jb-gray)' }}>
                    {minutosTranscurridos(orden.createdAt)}
                  </span>
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--jb-ink)' }}>{orden.clienteNombre}</span>
                <span style={{ fontSize: 13, color: 'var(--jb-ink-soft)' }}>
                  {formatearTelefono(orden.clienteTelefono)}
                </span>
                <span className="flex items-center justify-between" style={{ gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: estado.color }}>{estado.texto}</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--jb-ink)' }}>
                    {f(totalDeOrden(orden, pedidos))}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const botonAtras = {
  background: '#fff', border: '2.5px solid var(--jb-line)', borderRadius: 14,
  width: 48, height: 48, fontSize: 20, cursor: 'pointer', color: 'var(--jb-ink)', flexShrink: 0,
}

const botonSecundario = {
  fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 800,
  padding: '10px 16px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
  background: '#fff', border: '2.5px solid var(--jb-line)', color: 'var(--jb-ink)',
}
