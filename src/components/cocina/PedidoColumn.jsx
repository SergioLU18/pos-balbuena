import { PedidoCard } from './PedidoCard'

export function PedidoColumn({ titulo, color, pedidos, onAvanzar }) {
  return (
    <div className="h-full flex flex-col min-h-0" style={{ background: 'var(--jb-cream)', borderRadius: 24 }}>
      <div className="flex items-center flex-shrink-0" style={{ gap: 10, padding: '18px 20px 12px' }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--jb-ink)' }}>{titulo}</h2>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--jb-gray)' }}>{pedidos.length}</span>
      </div>
      <div
        className="flex-1 min-h-0 no-scrollbar"
        style={{ overflowY: 'auto', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {pedidos.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--jb-gray)', fontSize: 14, padding: '32px 0' }}>
            Sin pedidos aquí.
          </p>
        ) : (
          pedidos.map((p) => <PedidoCard key={p.id} pedido={p} onAvanzar={onAvanzar} />)
        )}
      </div>
    </div>
  )
}
