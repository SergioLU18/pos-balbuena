import { f } from '../../lib/utils'
import { describirMitades } from '../../lib/describirItem'
import { Button } from '../ui/Button'
import { calcItemPrecio } from '../../hooks/useOrderDraft'

function DescripcionItem({ item }) {
  return describirMitades(item).map(({ lado, prefijo, texto }) => (
    <p key={lado} style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--jb-ink-soft)' }}>
      {prefijo}{texto}
    </p>
  ))
}

// Etiqueta de solo lectura para un renglón cuyo pedido ya no está en Nuevo — mismo
// texto que usa MesaCard.jsx para el estado de cocina, para que se lea igual desde
// las dos pantallas del mesero.
const ESTADO_LABEL = {
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

function EnviadoRow({ item, pedido, onQty, onRemove }) {
  // Un renglón ya enviado puede venir "rico" (modo mock: tier + mitades en memoria) o
  // "plano" desde el backend de tali (nombre + precio_unitario). Se soportan ambos.
  const esRico = item.tier != null && item.mitades != null
  const precio = esRico ? calcItemPrecio(item) : Number(item.precio_unitario)
  const nombre = esRico ? `${item.platilloNombre} · ${item.tier.nombre}` : item.nombre
  // Editable mientras su comanda siga en Nuevo. Si no se encuentra el pedido de origen
  // (caso legado, o cuenta_items sin pedido asociado), se trata como no editable.
  const editable = pedido?.estado === 'pendiente'
  const estadoLabel = pedido ? ESTADO_LABEL[pedido.estado] : null

  function quitar() {
    if (window.confirm(`¿Quitar "${nombre}" de la comanda? Cocina ya la puede estar viendo.`)) {
      onRemove(pedido.id, item.id)
    }
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1.5px solid var(--jb-line)', opacity: editable ? 1 : 0.75 }}>
      <div className="flex items-start justify-between" style={{ gap: 10 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--jb-ink)' }}>
            {item.cantidad > 1 ? `${item.cantidad}× ` : ''}{nombre}
          </span>
          {esRico && <DescripcionItem item={item} />}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{f(precio * item.cantidad)}</span>
      </div>
      {editable ? (
        <CantidadControles
          cantidad={item.cantidad}
          onDec={() => onQty(pedido.id, item.id, -1)}
          onInc={() => onQty(pedido.id, item.id, 1)}
          onRemove={quitar}
        />
      ) : (
        <span style={{ fontSize: 11, fontWeight: 700, color: estadoLabel?.color ?? 'var(--jb-ok)' }}>
          {estadoLabel?.texto ?? 'Enviado a cocina ✓'}
        </span>
      )}
    </div>
  )
}

export function OrderTicket({ draft, cuenta, pedidos, subtotalDraft, subtotalCuenta, onQty, onRemove, onQtyEnviado, onRemoveEnviado, onEnviar }) {
  const totalGeneral = subtotalDraft + subtotalCuenta
  // Mapa itemId -> pedido de origen, para saber si un renglón ya enviado sigue editable
  // (su pedido en 'pendiente'/Nuevo) o ya lo tomó cocina.
  const pedidoPorItemId = new Map((pedidos ?? []).flatMap((p) => p.items.map((it) => [it.id, p])))

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: '#fff', borderRadius: 24, border: '2.5px solid var(--jb-line)', overflow: 'hidden' }}
    >
      <div style={{ padding: '18px 22px', borderBottom: '2px solid var(--jb-line)' }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--jb-ink)' }}>Comanda</h3>
      </div>

      <div className="flex-1 no-scrollbar" style={{ overflowY: 'auto', padding: '4px 22px' }}>
        {cuenta?.items?.length > 0 && cuenta.items.map((item) => (
          <EnviadoRow
            key={item.id}
            item={item}
            pedido={pedidoPorItemId.get(item.id)}
            onQty={onQtyEnviado}
            onRemove={onRemoveEnviado}
          />
        ))}

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
        <Button onClick={onEnviar} disabled={draft.length === 0} style={{ width: '100%' }}>
          Enviar {draft.length > 0 ? `${draft.length} platillo${draft.length > 1 ? 's' : ''} ` : ''}a cocina
        </Button>
      </div>
    </div>
  )
}
