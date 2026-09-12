import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { usePosStore, usePedidosStore } from '../../store/appStore'
import { useMenu } from '../../hooks/useMenu'
import { useOrderDraft } from '../../hooks/useOrderDraft'
import { useMesasUnidas } from '../../hooks/useMesasUnidas'
import { useVertical } from '../../hooks/useVertical'
import { etiquetaMesa, uid } from '../../lib/utils'
import { secundariasDe, nombreGrupo } from '../../lib/mesasUnidas'
import { CategoriaGrid } from '../../components/mesero/CategoriaGrid'
import { PlatilloCard } from '../../components/mesero/PlatilloCard'
import { ConfigurarPlatilloModal } from '../../components/mesero/ConfigurarPlatilloModal'
import { OrderTicket } from '../../components/mesero/OrderTicket'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { MetodoPagoModal } from '../../components/mesero/MetodoPagoModal'

export default function MeseroOrdenPage() {
  const { mesaId } = useParams()
  const navigate = useNavigate()
  const vertical = useVertical()
  const mesas = usePosStore((s) => s.mesas)
  const mesa = mesas.find((m) => m.id === mesaId)
  // Mesa unida a otra: no tiene cuenta propia, así que su pantalla es la de la principal.
  // Cubre los caminos que no pasan por el piso — un aviso de la campana, un link viejo,
  // o una tablet que tenía la secundaria abierta cuando otra la unió.
  const principalId = mesa?.joined_to && mesas.some((m) => m.id === mesa.joined_to) ? mesa.joined_to : null
  const secundarias = secundariasDe(mesas, mesaId)
  const nombre = mesa ? etiquetaMesa(nombreGrupo(mesa.numero, secundarias)) : '—'
  const { separarMesa } = useMesasUnidas()
  const pedidosMesa = usePedidosStore((s) => s.pedidos).filter((p) => p.mesaId === mesaId)
  const { menu, categorias, ingredientes, modificadores, extras } = useMenu()
  // null = paso 1 (categorías a pantalla completa); string = paso 2 (platillos de esa categoría)
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [platilloEnConfig, setPlatilloEnConfig] = useState(null)
  // Renglón del ticket que se está reeditando: { tipo: 'draft'|'enviado', platillo, item, pedidoId?, pedidoItemId? }
  const [editando, setEditando] = useState(null)
  // Confirmación en modal de la secundaria que se va a separar. Cerrar la mesa no pasa
  // por aquí: va directo a elegir método de pago (MetodoPagoModal ya trae su propia
  // confirmación antes de cerrar).
  const [eligiendoMetodoPago, setEligiendoMetodoPago] = useState(false)
  const [separando, setSeparando] = useState(null)

  const {
    draft, cuenta, subtotalDraft, subtotalCuenta,
    agregarItemConstruido, reemplazarItem, cambiarCantidad, quitarItem, enviarACocina,
    fijarCantidadEnviado, quitarItemEnviado, cerrarMesa,
  } = useOrderDraft(mesaId)

  const platillosCategoria = menu.filter((p) => p.categoria === categoriaActiva)

  // La mayoría de las categorías tienen un único platillo: en ese caso no tiene
  // sentido mostrar el paso intermedio de la grilla, se abre el pop up directo.
  function seleccionarCategoria(categoria) {
    const platillos = menu.filter((p) => p.categoria === categoria)
    if (platillos.length === 1) {
      setPlatilloEnConfig(platillos[0])
      return
    }
    setCategoriaActiva(categoria)
  }

  function confirmarPlatillo(item) {
    agregarItemConstruido(item)
    setPlatilloEnConfig(null)
  }

  // "Editar" en un renglón del ticket. Un platillo borrado del menú ya no se puede
  // reeditar (no hay tiers/variantes de dónde reconstruir): en ese caso no se abre.
  function editarRenglonDraft(item) {
    const platillo = menu.find((p) => p.id === item.platilloId)
    if (platillo) setEditando({ tipo: 'draft', platillo, item })
  }

  function editarRenglonEnviado(pedido, pedidoItemId, itemRico) {
    const platillo = menu.find((p) => p.id === itemRico.platilloId)
    if (platillo) setEditando({ tipo: 'enviado', platillo, item: itemRico, pedidoId: pedido.id, pedidoItemId })
  }

  // Guardar cambios: un renglón del draft se reemplaza en su lugar; uno ya enviado a
  // cocina se retira del pedido y vuelve al draft ya modificado, para que el mesero lo
  // reenvíe (así el cambio llega a la comanda de cocina de forma explícita).
  function confirmarEdicion(nuevoItem) {
    if (editando.tipo === 'draft') {
      reemplazarItem(editando.item.id, nuevoItem)
    } else {
      quitarItemEnviado(editando.pedidoId, editando.pedidoItemId)
      agregarItemConstruido({ ...nuevoItem, id: uid('item') })
    }
    setEditando(null)
  }

  // Enviar a cocina no saca al mesero de la mesa: el ticket se actualiza en su lugar
  // (los renglones pasan a "Enviado a cocina") para que pueda seguir agregando platillos
  // o revisar la orden. Vuelve al mapa de mesas con la flecha de atrás cuando termina.
  function handleEnviarACocina() {
    enviarACocina()
  }

  function handleSeleccionarMetodoPago(metodo, detalle) {
    setEligiendoMetodoPago(false)
    cerrarMesa(metodo, detalle)
    navigate('/mesero')
  }

  function handleSeparar() {
    const secundaria = separando
    setSeparando(null)
    separarMesa(secundaria.id)
  }

  if (principalId) return <Navigate to={`/mesero/orden/${principalId}`} replace />

  return (
    <div className="h-full flex flex-col" style={{ padding: vertical ? '16px 20px' : '20px 28px' }}>
      <div className="flex items-center flex-shrink-0" style={{ gap: 14, marginBottom: 16 }}>
        <button
          onClick={() => (categoriaActiva ? setCategoriaActiva(null) : navigate('/mesero'))}
          style={{
            background: '#fff', border: '2.5px solid var(--jb-line)', borderRadius: 14,
            width: 48, height: 48, fontSize: 20, cursor: 'pointer', color: 'var(--jb-ink)',
          }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: 'var(--jb-ink)', flex: 1 }}>
          {nombre}{categoriaActiva ? ` · ${categoriaActiva}` : ''}
        </h1>

        {secundarias.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeparando(s)}
            style={{
              fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 700,
              padding: '10px 16px', borderRadius: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              background: '#fff', border: '2px dashed var(--jb-gray)', color: 'var(--jb-ink-soft)',
            }}
          >
            Separar Mesa {s.numero}
          </button>
        ))}

        {cuenta && (
          <button
            onClick={() => setEligiendoMetodoPago(true)}
            style={{
              fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 700,
              padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
              background: '#fff', border: '2px solid #E0B4B4', color: '#A83232',
            }}
          >
            Cerrar mesa
          </button>
        )}
      </div>

      <div
        className="flex-1 min-h-0"
        style={{
          display: 'grid', gap: vertical ? 16 : 20,
          // En vertical el ticket ya no cabe al lado del menú: baja debajo de él, y el
          // menú se queda con un poco más de la mitad del alto.
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

        <OrderTicket
          draft={draft}
          cuenta={cuenta}
          pedidos={pedidosMesa}
          subtotalDraft={subtotalDraft}
          subtotalCuenta={subtotalCuenta}
          puedeEditarPlatillo={(id) => menu.some((p) => p.id === id)}
          onQty={cambiarCantidad}
          onRemove={quitarItem}
          onEditarDraft={editarRenglonDraft}
          onEditarEnviado={editarRenglonEnviado}
          onFijarEnviado={fijarCantidadEnviado}
          onRemoveEnviado={quitarItemEnviado}
          onEnviar={handleEnviarACocina}
        />
      </div>

      {platilloEnConfig && (
        <ConfigurarPlatilloModal
          platillo={platilloEnConfig}
          ingredientes={ingredientes}
          modificadores={modificadores}
          extras={extras}
          onConfirm={confirmarPlatillo}
          onClose={() => setPlatilloEnConfig(null)}
        />
      )}

      {editando && (
        <ConfigurarPlatilloModal
          platillo={editando.platillo}
          itemInicial={editando.item}
          ingredientes={ingredientes}
          modificadores={modificadores}
          extras={extras}
          onConfirm={confirmarEdicion}
          onClose={() => setEditando(null)}
        />
      )}

      {eligiendoMetodoPago && (
        <MetodoPagoModal
          total={subtotalCuenta}
          onSelect={handleSeleccionarMetodoPago}
          onClose={() => setEligiendoMetodoPago(false)}
        />
      )}

      {separando && (
        <ConfirmModal
          titulo={`¿Separar la Mesa ${separando.numero}?`}
          mensaje={`Lo que ya se pidió se queda en la cuenta de la Mesa ${mesa?.numero}. La Mesa ${separando.numero} vuelve a quedar libre para su propia cuenta.`}
          confirmarLabel="Separar"
          cancelarLabel="Volver"
          onConfirm={handleSeparar}
          onClose={() => setSeparando(null)}
        />
      )}
    </div>
  )
}
