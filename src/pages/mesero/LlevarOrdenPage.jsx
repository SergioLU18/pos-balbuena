import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMenu } from '../../hooks/useMenu'
import { useOrdenLlevar } from '../../hooks/useOrdenLlevar'
import { useVertical } from '../../hooks/useVertical'
import { formatearTelefono } from '../../lib/telefono'
import { CategoriaGrid } from '../../components/mesero/CategoriaGrid'
import { PlatilloCard } from '../../components/mesero/PlatilloCard'
import { ConfigurarPlatilloModal } from '../../components/mesero/ConfigurarPlatilloModal'
import { OrderTicket } from '../../components/mesero/OrderTicket'
import { claveRenglonPorId } from '../../lib/renglones'
import { ConfirmModal } from '../../components/ui/ConfirmModal'

/** Toma de orden PARA LLEVAR. Es la misma pantalla que la de una mesa —mismo catálogo,
 *  mismo pop-up de configuración, mismo ticket— cambiando quién recibe la orden: en vez
 *  de "Mesa 7", el cliente que se buscó por teléfono. Lo que se manda a cocina es un
 *  pedido idéntico a cualquier otro, solo que sin mesa (ver useOrdenLlevar). */
export default function LlevarOrdenPage() {
  const { ordenId } = useParams()
  const navigate = useNavigate()
  const vertical = useVertical()
  const { menu, categorias, ingredientes, modificadores, extras } = useMenu()
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [platilloEnConfig, setPlatilloEnConfig] = useState(null)
  const [cerrando, setCerrando] = useState(null) // 'entregada' | 'cancelada' | 'descartar' | null

  const {
    orden, draft, pedidos, enviados, subtotalDraft, subtotalEnviado,
    agregarItemConstruido, cambiarCantidad, quitarItem, enviarACocina,
    fijarCantidadEnviado, quitarItemEnviado, cerrarOrden, descartarOrden,
  } = useOrdenLlevar(ordenId)

  // Nada enviado a cocina todavía. Una orden así no se cancela ni se deja abierta: se
  // descarta (ver descartarOrden), para que no queden órdenes fantasma de $0 colgadas
  // del cliente — que además impedían darlo de baja.
  const vacia = enviados.length === 0

  const platillosCategoria = menu.filter((p) => p.categoria === categoriaActiva)

  // Igual que en la orden de mesa: si la categoría tiene un solo platillo, el paso
  // intermedio de la grilla no aporta nada y se abre el pop-up directo.
  function seleccionarCategoria(categoria) {
    const platillos = menu.filter((p) => p.categoria === categoria)
    if (platillos.length === 1) { setPlatilloEnConfig(platillos[0]); return }
    setCategoriaActiva(categoria)
  }

  function descartar() {
    navigate('/mesero/llevar')
    descartarOrden()
  }

  // Salir de una orden vacía la descarta. Si hay platillos capturados sin enviar se
  // pregunta antes: el draft vive solo en esta tablet y se perdería sin aviso.
  function salir() {
    if (categoriaActiva) { setCategoriaActiva(null); return }
    if (!vacia) { navigate('/mesero/llevar'); return }
    if (draft.length > 0) { setCerrando('descartar'); return }
    descartar()
  }

  async function confirmarCierre() {
    const estado = cerrando
    setCerrando(null)
    if (estado === 'descartar') { descartar(); return }
    const { error } = await cerrarOrden(estado)
    if (!error) navigate('/mesero/llevar')
  }

  if (!orden) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ gap: 16, padding: 32 }}>
        <p style={{ margin: 0, fontSize: 17, color: 'var(--jb-ink-soft)' }}>
          Esta orden para llevar ya no está abierta.
        </p>
        <button onClick={() => navigate('/mesero/llevar')} style={{ ...botonSecundario, fontSize: 16 }}>
          Volver a Para llevar
        </button>
      </div>
    )
  }

  const cocinando = pedidos.some((p) => p.estado === 'pendiente' || p.estado === 'preparando')
  const quien = `La orden L-${orden.folio} de ${orden.clienteNombre}`
  const dialogo = {
    cancelada: {
      titulo: '¿Cancelar la orden?',
      mensaje: `${quien} se marcará como cancelada${cocinando ? ' y sus comandas saldrán del tablero de cocina, aunque todavía se estén preparando' : ''}.`,
      confirmar: 'Sí, cancelar',
    },
    entregada: {
      titulo: '¿Entregar y cerrar la orden?',
      mensaje: `${quien} quedará cerrada y guardada en su historial de compras${cocinando ? '. Ojo: todavía tiene platillos en cocina' : ''}.`,
      confirmar: 'Sí, entregar',
    },
    descartar: {
      titulo: '¿Descartar la orden?',
      mensaje: draft.length > 0
        ? `${quien} no tiene nada enviado a cocina. Se descarta junto con los platillos capturados sin enviar.`
        : `${quien} no tiene platillos, así que se descarta sin quedar en su historial.`,
      confirmar: 'Sí, descartar',
    },
  }[cerrando]

  return (
    <div className="h-full flex flex-col" style={{ padding: vertical ? '16px 20px' : '20px 28px' }}>
      <div className="flex items-center flex-shrink-0" style={{ gap: 14, marginBottom: 16 }}>
        <button
          onClick={salir}
          aria-label="Atrás"
          style={botonAtras}
        >
          ←
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>
            <span style={etiquetaLlevar}>Para llevar · L-{orden.folio}</span>
            <span style={{ marginLeft: 12 }}>{orden.clienteNombre}</span>
            {categoriaActiva ? <span style={{ color: 'var(--jb-ink-soft)' }}> · {categoriaActiva}</span> : null}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--jb-ink-soft)' }}>
            {formatearTelefono(orden.clienteTelefono)}
            {orden.direccion ? ` · ${orden.direccion}` : ''}
          </p>
        </div>

        <button
          onClick={() => setCerrando(vacia ? 'descartar' : 'cancelada')}
          style={{ ...botonSecundario, color: '#A83232', borderColor: '#E0B4B4' }}
        >
          Cancelar orden
        </button>
        <button
          onClick={() => setCerrando('entregada')}
          disabled={vacia}
          style={{
            ...botonSecundario, background: 'var(--jb-teal)', color: '#fff', borderColor: 'var(--jb-teal)',
            opacity: vacia ? 0.45 : 1, cursor: vacia ? 'default' : 'pointer',
          }}
        >
          Entregar y cerrar
        </button>
      </div>

      <div
        className="flex-1 min-h-0"
        style={{
          display: 'grid', gap: vertical ? 16 : 20,
          // Mismo reacomodo que la orden de mesa: en vertical el ticket baja debajo del menú.
          ...(vertical
            ? { gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1.4fr) minmax(0, 1fr)' }
            : { gridTemplateColumns: 'minmax(0, 1.5fr) 380px' }),
        }}
      >
        <div className="flex flex-col min-h-0 min-w-0" style={{ gap: 4 }}>
          <div className={categoriaActiva === null ? 'flex-1 min-h-0' : 'flex-shrink-0'}>
            <CategoriaGrid
              categorias={categorias}
              activa={categoriaActiva}
              onSelect={seleccionarCategoria}
              compact={categoriaActiva !== null}
            />
          </div>

          {categoriaActiva !== null && (
            <div
              key={categoriaActiva}
              className="jb-slide-in flex-1 min-h-0 no-scrollbar"
              style={{
                overflowY: 'auto', display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, alignContent: 'start',
              }}
            >
              {platillosCategoria.map((p) => (
                <PlatilloCard key={p.id} platillo={p} onClick={() => setPlatilloEnConfig(p)} />
              ))}
            </div>
          )}
        </div>

        {/* El ticket es el mismo de las mesas. La diferencia está en `clave`: aquí los
            renglones mostrados SON los de las comandas (no hay cuenta_items detrás), así
            que casan por id — ver el comentario de claveRenglonPorId. */}
        <OrderTicket
          titulo={`Orden L-${orden.folio}`}
          draft={draft}
          cuenta={{ items: enviados }}
          pedidos={pedidos}
          clave={claveRenglonPorId}
          subtotalDraft={subtotalDraft}
          subtotalCuenta={subtotalEnviado}
          onQty={cambiarCantidad}
          onRemove={quitarItem}
          onFijarEnviado={fijarCantidadEnviado}
          onRemoveEnviado={quitarItemEnviado}
          onEnviar={enviarACocina}
        />
      </div>

      {platilloEnConfig && (
        <ConfigurarPlatilloModal
          platillo={platilloEnConfig}
          ingredientes={ingredientes}
          modificadores={modificadores}
          extras={extras}
          onConfirm={(item) => { agregarItemConstruido(item); setPlatilloEnConfig(null) }}
          onClose={() => setPlatilloEnConfig(null)}
        />
      )}

      {dialogo && (
        <ConfirmModal
          titulo={dialogo.titulo}
          mensaje={dialogo.mensaje}
          confirmarLabel={dialogo.confirmar}
          cancelarLabel="Volver"
          danger={cerrando !== 'entregada'}
          onConfirm={confirmarCierre}
          onClose={() => setCerrando(null)}
        />
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
  padding: '11px 16px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
  background: '#fff', border: '2px solid var(--jb-line)', color: 'var(--jb-ink)',
}

const etiquetaLlevar = {
  display: 'inline-block', fontSize: 13, fontWeight: 900, letterSpacing: 0.4,
  color: '#fff', background: 'var(--jb-pink)', borderRadius: 999, padding: '5px 12px',
  verticalAlign: 'middle',
}
