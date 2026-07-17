import { useState } from 'react'
import { f } from '../../lib/utils'
import { describirMitades, extrasTexto } from '../../lib/describirItem'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { calcItemPrecio } from '../../hooks/useOrderDraft'

function DescripcionItem({ item }) {
  const extras = extrasTexto(item)
  return (
    <>
      {describirMitades(item).map(({ lado, prefijo, texto }) => (
        <p key={lado} style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--jb-ink-soft)' }}>
          {prefijo}{texto}
        </p>
      ))}
      {extras && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--jb-ink-soft)' }}>{extras}</p>}
    </>
  )
}

// Etiqueta de solo lectura para un renglón cuyo pedido ya no está en Nuevo — mismo
// texto que usa MesaCard.jsx para el estado de cocina, para que se lea igual desde
// las dos pantallas del mesero.
const ESTADO_LABEL = {
  // 'pendiente' = ya enviado a cocina pero todavía en la columna "Nuevo" (cocina no lo
  // empezó): sigue editable, pero necesita su propia etiqueta para no confundirse con un
  // renglón del draft que aún no se ha mandado.
  pendiente: { texto: 'Enviado a cocina ✓', color: 'var(--jb-ok)' },
  preparando: { texto: 'En preparación', color: '#2C5F86' },
  listo: { texto: '¡Listo para servir!', color: '#1B5E66' },
  entregado: { texto: 'Entregado', color: 'var(--jb-gray)' },
}

function CantidadControles({ cantidad, onDec, onInc, onRemove }) {
  return (
    <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
      <div className="flex items-center" style={{ gap: 0, border: '2px solid var(--jb-line)', borderRadius: 10, overflow: 'hidden' }}>
        <button onClick={onDec} style={{ width: 34, height: 34, border: 'none', background: 'var(--jb-cream)', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>−</button>
        <span style={{ width: 30, textAlign: 'center', fontSize: 14, fontWeight: 800 }}>{cantidad}</span>
        <button onClick={onInc} style={{ width: 34, height: 34, border: 'none', background: 'var(--jb-cream)', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>+</button>
      </div>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#C24A4A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        Quitar
      </button>
    </div>
  )
}

function DraftRow({ item, onQty, onRemove }) {
  const precio = calcItemPrecio(item)
  return (
    <div className="jb-fade-up" style={{ padding: '12px 0', borderBottom: '1.5px solid var(--jb-line)' }}>
      <div className="flex items-start justify-between" style={{ gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--jb-ink)' }}>
            {item.cantidad > 1 ? `${item.cantidad}× ` : ''}{item.platilloNombre} · {item.tier.nombre}
          </span>
          <DescripcionItem item={item} />
          {item.nota && <p style={{ margin: '2px 0 0', fontSize: 12, fontStyle: 'italic', color: 'var(--jb-pink-dark)' }}>“{item.nota}”</p>}
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--jb-ink)', flexShrink: 0 }}>{f(precio * item.cantidad)}</span>
      </div>
      <CantidadControles
        cantidad={item.cantidad}
        onDec={() => onQty(item.id, -1)}
        onInc={() => onQty(item.id, 1)}
        onRemove={() => onRemove(item.id)}
      />
    </div>
  )
}

function EnviadoRow({ item, pedido, pedidoItemId, staged, onStage, onRevert, onRemove }) {
  // Un renglón ya enviado puede venir "rico" (modo mock: tier + mitades en memoria) o
  // "plano" desde el backend de tali (nombre + precio_unitario). Se soportan ambos.
  const esRico = item.tier != null && item.mitades != null
  const precio = esRico ? calcItemPrecio(item) : Number(item.precio_unitario)
  const nombre = esRico ? `${item.platilloNombre} · ${item.tier.nombre}` : item.nombre
  // Editable mientras su comanda siga en Nuevo. Si no se encuentra el pedido de origen
  // (caso legado, o cuenta_items sin pedido asociado), se trata como no editable.
  const editable = pedido?.estado === 'pendiente'
  const estadoLabel = pedido ? ESTADO_LABEL[pedido.estado] : null
  const [confirmando, setConfirmando] = useState(false)

  // Los −/+ NO mandan nada a cocina: solo ajustan una cantidad en preview (`staged`) que
  // se confirma al pulsar "Enviar a cocina". Mientras `staged` difiera de lo ya enviado,
  // el renglón muestra un aviso de "cambio sin enviar" y un botón para descartarlo.
  const enviada = item.cantidad
  const cantidad = editable && staged != null ? staged : enviada
  const editado = editable && staged != null && staged !== enviada

  function confirmarQuitar() {
    onRemove(pedido.id, pedidoItemId)
    setConfirmando(false)
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1.5px solid var(--jb-line)', opacity: editable ? 1 : 0.75 }}>
      <div className="flex items-start justify-between" style={{ gap: 10 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--jb-ink)' }}>
            {cantidad > 1 ? `${cantidad}× ` : ''}{nombre}
          </span>
          {esRico && <DescripcionItem item={item} />}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{f(precio * cantidad)}</span>
      </div>
      <span style={{ display: 'block', marginTop: 4, fontSize: 11, fontWeight: 700, color: estadoLabel?.color ?? 'var(--jb-ok)' }}>
        {estadoLabel?.texto ?? 'Enviado a cocina ✓'}
        {editado && (
          <span style={{ color: 'var(--jb-pink-dark)' }}> · cambio sin enviar (antes {enviada})</span>
        )}
      </span>
      {editable && (
        <CantidadControles
          cantidad={cantidad}
          onDec={() => onStage(pedidoItemId, cantidad - 1)}
          onInc={() => onStage(pedidoItemId, cantidad + 1)}
          onRemove={() => setConfirmando(true)}
        />
      )}
      {editado && (
        <button
          onClick={() => onRevert(pedidoItemId)}
          style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, color: 'var(--jb-ink-soft)', fontSize: 12, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
        >
          Deshacer cambio
        </button>
      )}

      {confirmando && (
        <ConfirmModal
          titulo="¿Quitar platillo?"
          mensaje={`Se quitará "${nombre}" de la comanda. Ya está enviado a cocina, así que también desaparecerá de su tablero.`}
          confirmarLabel="Sí, quitar"
          cancelarLabel="Conservar"
          danger
          onConfirm={confirmarQuitar}
          onClose={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}

// Clave para casar un renglón de la cuenta (cuenta_items) con el renglón que lo
// originó dentro de un pedido (pedidos.items). En backend ambos comparten `nombre`
// (cuenta_items es plano y se agrega por nombre), pero NO el id: cuenta_items trae su
// propio id de fila. En mock los objetos son los mismos y sí comparten id, y no tienen
// `nombre`. `nombre ?? id` sirve para los dos casos.
const claveRenglon = (it) => it.nombre ?? it.id

export function OrderTicket({ draft, cuenta, pedidos, subtotalDraft, subtotalCuenta, onQty, onRemove, onFijarEnviado, onRemoveEnviado, onEnviar }) {
  // Mapa clave -> { pedido de origen, id del renglón DENTRO de ese pedido }, para saber
  // si un renglón ya enviado sigue editable (su pedido en 'pendiente'/Nuevo) o ya lo tomó
  // cocina, y para pasarle a la RPC el item id del pedido (no el de cuenta_items). Se
  // prefiere un pedido en 'pendiente' cuando el mismo nombre aparece en varias comandas.
  const origenPorClave = new Map()
  for (const p of pedidos ?? []) {
    for (const it of p.items) {
      const clave = claveRenglon(it)
      const prev = origenPorClave.get(clave)
      if (!prev || (p.estado === 'pendiente' && prev.pedido.estado !== 'pendiente')) {
        origenPorClave.set(clave, { pedido: p, itemId: it.id })
      }
    }
  }

  // Ajustes de cantidad en preview sobre renglones ya enviados, por id de renglón del
  // pedido. No tocan cocina hasta pulsar "Enviar a cocina" (que los confirma en bloque).
  const [edits, setEdits] = useState({})
  const stageQty = (pedidoItemId, next) => setEdits((e) => ({ ...e, [pedidoItemId]: Math.max(1, next) }))
  const revertQty = (pedidoItemId) => setEdits((e) => { const { [pedidoItemId]: _omit, ...rest } = e; return rest })
  // Al quitar un renglón se descarta también cualquier ajuste pendiente suyo.
  const quitarEnviado = (pedidoId, pedidoItemId) => { revertQty(pedidoItemId); onRemoveEnviado(pedidoId, pedidoItemId) }

  // Ajustes pendientes reales (staged distinto de lo enviado) + su efecto en el total,
  // para habilitar el botón y mostrar el total ya con los cambios reflejados.
  const editsPendientes = []
  let editDelta = 0
  for (const item of cuenta?.items ?? []) {
    const origen = origenPorClave.get(claveRenglon(item))
    if (!origen) continue
    const staged = edits[origen.itemId]
    if (staged == null || staged === item.cantidad) continue
    editsPendientes.push({ pedidoId: origen.pedido.id, itemId: origen.itemId, cantidad: staged })
    const precio = item.precio_unitario != null ? Number(item.precio_unitario) : calcItemPrecio(item)
    editDelta += precio * (staged - item.cantidad)
  }

  const hayEdits = editsPendientes.length > 0
  const totalGeneral = subtotalDraft + subtotalCuenta + editDelta
  const puedeEnviar = draft.length > 0 || hayEdits

  function enviarTodo() {
    editsPendientes.forEach((e) => onFijarEnviado(e.pedidoId, e.itemId, e.cantidad))
    if (draft.length > 0) onEnviar()
    setEdits({})
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: '#fff', borderRadius: 24, border: '2.5px solid var(--jb-line)', overflow: 'hidden' }}
    >
      <div style={{ padding: '18px 22px', borderBottom: '2px solid var(--jb-line)' }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--jb-ink)' }}>Comanda</h3>
      </div>

      <div className="flex-1 no-scrollbar" style={{ overflowY: 'auto', padding: '4px 22px' }}>
        {cuenta?.items?.length > 0 && cuenta.items.map((item) => {
          const origen = origenPorClave.get(claveRenglon(item))
          return (
            <EnviadoRow
              key={item.id}
              item={item}
              pedido={origen?.pedido}
              pedidoItemId={origen?.itemId}
              staged={origen ? edits[origen.itemId] : undefined}
              onStage={stageQty}
              onRevert={revertQty}
              onRemove={quitarEnviado}
            />
          )
        })}

        {draft.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--jb-gray)', fontSize: 14, padding: '32px 0' }}>
            Toca un platillo para agregarlo a la orden.
          </p>
        ) : (
          draft.map((item) => <DraftRow key={item.id} item={item} onQty={onQty} onRemove={onRemove} />)
        )}
      </div>

      <div style={{ padding: '18px 22px', borderTop: '2px solid var(--jb-line)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--jb-ink-soft)' }}>Total</span>
          <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>{f(totalGeneral)}</span>
        </div>
        <Button onClick={enviarTodo} disabled={!puedeEnviar} style={{ width: '100%' }}>
          {draft.length > 0
            ? `Enviar ${draft.length} platillo${draft.length > 1 ? 's' : ''}${hayEdits ? ' y cambios' : ''} a cocina`
            : hayEdits ? 'Enviar cambios a cocina' : 'Enviar a cocina'}
        </Button>
      </div>
    </div>
  )
}
