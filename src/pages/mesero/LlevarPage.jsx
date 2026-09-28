import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLlevar, totalDeOrden, ESTADO_LLEVAR } from '../../hooks/useLlevar'
import { useMesas } from '../../hooks/useMesas'
import { useVertical } from '../../hooks/useVertical'
import { formatearTelefono, telefonoCompleto } from '../../lib/telefono'
import { nombreCompleto, formatearDireccion } from '../../lib/cliente'
import { f } from '../../lib/utils'
import { TelefonoPad } from '../../components/mesero/TelefonoPad'
import { ClienteForm } from '../../components/mesero/ClienteForm'
import { HistorialCliente } from '../../components/mesero/HistorialCliente'
import { PedidosModal } from '../../components/mesero/PedidosModal'
import { Button } from '../../components/ui/Button'

// Pasos de la pantalla. En "ordenes" el teclado va solo, centrado — es el foco
// mientras no hay nadie buscado. En los otros tres queda al lado de un panel (se puede
// buscar otro número sin tener que "salir" de la ficha que se esté viendo).
//   ordenes  — nada buscado todavía: preview de las órdenes para llevar abiertas
//   ficha    — el teléfono ya existe en el padrón: datos + historial + tomar orden
//   nuevo    — el teléfono no existe: alta del cliente
//   editar   — corrección de la ficha de un cliente que sí existe
const PASOS = { ordenes: 'ordenes', ficha: 'ficha', nuevo: 'nuevo', editar: 'editar' }

export default function LlevarPage() {
  const navigate = useNavigate()
  const vertical = useVertical()
  const { ordenesAbiertas, pedidos, buscarPorTelefono, guardarCliente, crearOrden, historialCliente } = useLlevar()
  const { mesas } = useMesas()

  const [telefono, setTelefono] = useState('')
  const [paso, setPaso] = useState(PASOS.ordenes)
  const [cliente, setCliente] = useState(null)
  const [historial, setHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  const [pedidosAbierto, setPedidosAbierto] = useState(false)

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

      {paso === PASOS.ordenes ? (
        // Nada buscado todavía: el foco es capturar el teléfono, así que va solo,
        // centrado y grande — no compitiendo por espacio con un panel al lado. Lo que
        // sigue abierto se asoma abajo nomás como preview; "Ver todos" abre el mismo
        // pop-up de Pedidos que usa el piso, ya en su pestaña de para llevar.
        <div className="flex-1 min-h-0 no-scrollbar" style={{ overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: vertical ? 18 : 24 }}>
            <div
              style={{
                background: '#fff', border: '2.5px solid var(--jb-line)', borderRadius: 24,
                padding: vertical ? '22px 20px' : '30px 34px',
              }}
            >
              <TelefonoPad
                valor={telefono}
                onDigito={tecla}
                onBorrar={() => { setError(null); setTelefono((t) => t.slice(0, -1)) }}
                onLimpiar={limpiar}
                onBuscar={buscar}
                buscando={ocupado}
                error={error}
              />
            </div>

            <PedidosLlevarPreview
              ordenes={ordenesAbiertas}
              pedidos={pedidos}
              onExpandir={() => setPedidosAbierto(true)}
            />
          </div>
        </div>
      ) : (
        // Con un cliente en pantalla (ficha/alta/edición) sí hace falta el teclado al
        // lado: en la ficha se puede buscar otro número sin salir de la que se está viendo.
        // En vertical el teclado se angosta (sigue a un lado, no arriba) para que el
        // formulario y la ficha conserven un ancho cómodo.
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
              buscando={false}
              error={null}
              // Con la ficha abierta el número ya es su llave: un ⌫ perdido registraba al
              // cliente con 9 dígitos. Para otro número, "Cancelar" en la ficha.
              bloqueado={paso === PASOS.nuevo || paso === PASOS.editar}
            />
          </div>

          <div
            className="no-scrollbar"
            style={{
              overflowY: 'auto', background: '#fff', border: '2.5px solid var(--jb-line)',
              borderRadius: 24, padding: '22px 24px',
            }}
          >
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
                // Del cliente y no del teclado: en la ficha el teclado sigue vivo (para buscar
                // otro número), y editar con lo que se haya tecleado ahí le pisaba la ficha a
                // quien tuviera ese otro teléfono.
                telefono={cliente.telefono}
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

            {error && (
              <p style={{ margin: '14px 0 0', fontSize: 14, fontWeight: 700, color: '#C24A4A' }}>{error}</p>
            )}
          </div>
        </div>
      )}

      {pedidosAbierto && (
        <PedidosModal
          mesas={mesas.filter((m) => m.estado === 'abierta')}
          ordenesLlevar={ordenesAbiertas}
          pedidos={pedidos}
          onClose={() => setPedidosAbierto(false)}
        />
      )}
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
          <h2 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 900, color: 'var(--jb-ink)' }}>{nombreCompleto(cliente)}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 16, color: 'var(--jb-ink-soft)' }}>
            {formatearTelefono(cliente.telefono)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 16, color: 'var(--jb-ink-soft)' }}>{formatearDireccion(cliente)}</p>
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

// Solo un adelanto de lo que sigue abierto — 3 cuando mucho, tal cual las devuelve
// useLlevar (la más vieja primero: es la más urgente). El detalle completo, y la
// acción real sobre cada una, viven en el pop-up de Pedidos (PedidosModal); aquí
// cualquier toque —una tarjeta, el chip de "+N", el botón— lleva a lo mismo.
const PREVIEW_MAX = 3

function PedidosLlevarPreview({ ordenes, pedidos, onExpandir }) {
  const preview = ordenes.slice(0, PREVIEW_MAX)
  const restantes = ordenes.length - preview.length

  return (
    <div style={{ background: '#fff', border: '2.5px solid var(--jb-line)', borderRadius: 24, padding: '20px 24px' }}>
      <div className="flex items-center justify-between" style={{ gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--jb-ink)' }}>
            Para llevar abiertas {ordenes.length > 0 && `(${ordenes.length})`}
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--jb-ink-soft)' }}>
            Las que siguen sin entregarse.
          </p>
        </div>
        {ordenes.length > 0 && (
          <button onClick={onExpandir} style={botonExpandir}>
            Ver todas →
          </button>
        )}
      </div>

      {ordenes.length === 0 ? (
        <p style={{ margin: '18px 0 2px', textAlign: 'center', fontSize: 14, color: 'var(--jb-gray)' }}>
          No hay órdenes para llevar abiertas.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 14 }}>
          {preview.map((orden) => {
            const estado = ESTADO_LLEVAR[orden.estado] ?? { texto: orden.estado, color: 'var(--jb-gray)', fondo: '#fff', borde: 'var(--jb-line)' }
            return (
              <button
                key={orden.id}
                onClick={onExpandir}
                className="jb-fade-up"
                style={{
                  background: estado.fondo, border: `2px solid ${estado.borde}`, borderRadius: 14,
                  padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                  fontFamily: "'Inter Tight', sans-serif", display: 'flex', flexDirection: 'column', gap: 2,
                }}
              >
                <span className="flex items-center justify-between" style={{ gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--jb-ink)' }}>L-{orden.folio} · {orden.clienteNombre}</span>
                </span>
                <span className="flex items-center justify-between" style={{ gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: estado.color }}>{estado.texto}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--jb-ink)' }}>
                    {f(totalDeOrden(orden, pedidos))}
                  </span>
                </span>
              </button>
            )
          })}
          {restantes > 0 && (
            <button
              onClick={onExpandir}
              style={{
                border: '2px dashed var(--jb-line)', borderRadius: 14, background: 'var(--jb-cream)',
                cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 800,
                color: 'var(--jb-ink-soft)', minHeight: 56,
              }}
            >
              +{restantes} más
            </button>
          )}
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

const botonExpandir = {
  fontFamily: "'Inter Tight', sans-serif", fontSize: 13, fontWeight: 800,
  padding: '9px 14px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
  background: 'var(--jb-pink-tint)', border: '2px solid var(--jb-pink-light)', color: 'var(--jb-pink-dark)',
}
