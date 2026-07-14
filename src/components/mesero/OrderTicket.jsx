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
      <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
        <div className="flex items-center" style={{ gap: 0, border: '2px solid var(--jb-line)', borderRadius: 10, overflow: 'hidden' }}>
          <button onClick={() => onQty(item.id, -1)} style={{ width: 34, height: 34, border: 'none', background: 'var(--jb-cream)', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>−</button>
          <span style={{ width: 30, textAlign: 'center', fontSize: 14, fontWeight: 800 }}>{item.cantidad}</span>
          <button onClick={() => onQty(item.id, 1)} style={{ width: 34, height: 34, border: 'none', background: 'var(--jb-cream)', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>+</button>
        </div>
        <button onClick={() => onRemove(item.id)} style={{ background: 'none', border: 'none', color: '#C24A4A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Quitar
        </button>
      </div>
    </div>
  )
}

function EnviadoRow({ item }) {
  // Un renglón ya enviado puede venir "rico" (modo mock: tier + mitades en memoria) o
  // "plano" desde el backend de tali (nombre + precio_unitario). Se soportan ambos.
  const esRico = item.tier != null && item.mitades != null
  const precio = esRico ? calcItemPrecio(item) : Number(item.precio_unitario)
  const nombre = esRico ? `${item.platilloNombre} · ${item.tier.nombre}` : item.nombre
  return (
    <div style={{ padding: '10px 0', borderBottom: '1.5px solid var(--jb-line)', opacity: 0.75 }}>
      <div className="flex items-start justify-between" style={{ gap: 10 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--jb-ink)' }}>
            {item.cantidad > 1 ? `${item.cantidad}× ` : ''}{nombre}
          </span>
          {esRico && <DescripcionItem item={item} />}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{f(precio * item.cantidad)}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--jb-ok)' }}>Enviado a cocina ✓</span>
    </div>
  )
}

export function OrderTicket({ draft, cuenta, subtotalDraft, subtotalCuenta, onQty, onRemove, onEnviar }) {
  const totalGeneral = subtotalDraft + subtotalCuenta

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: '#fff', borderRadius: 24, border: '2.5px solid var(--jb-line)', overflow: 'hidden' }}
    >
      <div style={{ padding: '18px 22px', borderBottom: '2px solid var(--jb-line)' }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--jb-ink)' }}>Comanda</h3>
      </div>

      <div className="flex-1 no-scrollbar" style={{ overflowY: 'auto', padding: '4px 22px' }}>
        {cuenta?.items?.length > 0 && cuenta.items.map((item) => <EnviadoRow key={item.id} item={item} />)}

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
