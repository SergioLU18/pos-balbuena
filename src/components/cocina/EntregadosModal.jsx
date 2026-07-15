import { minutosTranscurridos, duracionMin } from '../../lib/utils'
import { ItemLine } from './PedidoCard'

/** Backlog de comandas ya recogidas por el mesero (estado 'entregado'), de más
 *  reciente a más antigua. Es solo consulta — no hay acción que tomar aquí. */
export function EntregadosModal({ pedidos, onClose }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
      }}
    >
      <div
        className="jb-pop no-scrollbar"
        style={{
          background: '#fff', borderRadius: 26, width: 640, maxWidth: '100%', maxHeight: '86vh',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
          fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
        }}
      >
        <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>Comandas entregadas</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--jb-ink-soft)' }}>
              Recogidas por el mesero — la más reciente arriba.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--jb-pink-light)', border: 'none', borderRadius: 12, width: 40, height: 40, fontSize: 18, fontWeight: 800, color: 'var(--jb-pink-dark)', cursor: 'pointer', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pedidos.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--jb-gray)', fontSize: 14, padding: '32px 0' }}>
              Aún no se ha recogido ninguna comanda.
            </p>
          ) : (
            pedidos.map((p) => (
              <div key={p.id} style={{ border: '2.5px solid var(--jb-line)', borderRadius: 18, padding: '14px 18px' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline" style={{ gap: 10 }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--jb-ink)' }}>Mesa {p.mesaNumero}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-ink-soft)' }}>{p.meseroNombre}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--jb-gray)' }}>
                    Recogido {minutosTranscurridos(p.estadoActualizadoAt)}
                  </span>
                </div>
                <div>
                  {p.items.map((item) => <ItemLine key={item.id} item={item} />)}
                </div>
                {p.listoAt && p.entregadoAt && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--jb-teal)' }}>
                    Esperó {duracionMin(p.listoAt, p.entregadoAt)} en "Listos" antes de que lo recogieran
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
