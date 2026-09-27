import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { totalDeOrden, ESTADO_LLEVAR } from '../../hooks/useLlevar'
import { f, minutosTranscurridos } from '../../lib/utils'
import { nombreGrupo } from '../../lib/mesasUnidas'

const tabBtn = (activo) => ({
  flex: 1, padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
  fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 800,
  background: activo ? '#fff' : 'transparent',
  color: activo ? 'var(--jb-ink)' : 'var(--jb-ink-soft)',
  boxShadow: activo ? '0 2px 6px rgba(51,34,42,0.12)' : 'none',
})

/** Todo lo que sigue abierto ahora mismo — mesas con cuenta y órdenes para llevar sin
 *  entregar — en un solo pop-up, separado por pestaña para no mezclar los dos flujos.
 *  Es solo un directorio para saltar rápido a la cuenta: tocar una fila cierra el
 *  pop-up y navega a esa cuenta, igual que tocar la mesa o la tarjeta de la orden en
 *  sus propias pantallas. */
export function PedidosModal({ mesas, ordenesLlevar, pedidos, onClose }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('llevar')

  function abrirMesa(mesa) {
    onClose()
    navigate(`/mesero/orden/${mesa.unidaA?.id ?? mesa.id}`)
  }

  function abrirLlevar(orden) {
    onClose()
    navigate(`/mesero/llevar/orden/${orden.id}`)
  }

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
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>Pedidos abiertos</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--jb-ink-soft)' }}>
              Mesas sin pagar y órdenes para llevar sin entregar.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--jb-pink-light)', border: 'none', borderRadius: 12, width: 40, height: 40, fontSize: 18, fontWeight: 800, color: 'var(--jb-pink-dark)', cursor: 'pointer', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: 'var(--jb-cream)' }}>
            <button style={tabBtn(tab === 'mesa')} onClick={() => setTab('mesa')}>
              Restaurante {mesas.length > 0 && `(${mesas.length})`}
            </button>
            <button style={tabBtn(tab === 'llevar')} onClick={() => setTab('llevar')}>
              Para llevar {ordenesLlevar.length > 0 && `(${ordenesLlevar.length})`}
            </button>
          </div>
        </div>

        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'mesa' ? (
            mesas.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--jb-gray)', fontSize: 14, padding: '32px 0' }}>
                No hay mesas con cuenta abierta.
              </p>
            ) : (
              mesas.map((mesa) => (
                <button
                  key={mesa.id}
                  onClick={() => abrirMesa(mesa)}
                  className="jb-fade-up"
                  style={{
                    background: 'var(--jb-ok-bg)', border: '2.5px solid var(--jb-ok)', borderRadius: 18,
                    padding: '14px 18px', cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'Inter Tight', sans-serif",
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--jb-ink)' }}>
                      Mesa {nombreGrupo(mesa.numero, mesa.unidas)}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--jb-ink-soft)' }}>
                      {minutosTranscurridos(mesa.createdAt)}
                    </span>
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#2C7A50' }}>{f(mesa.total)}</span>
                </button>
              ))
            )
          ) : ordenesLlevar.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--jb-gray)', fontSize: 14, padding: '32px 0' }}>
              No hay órdenes para llevar abiertas.
            </p>
          ) : (
            ordenesLlevar.map((orden) => {
              const estado = ESTADO_LLEVAR[orden.estado] ?? { texto: orden.estado, color: 'var(--jb-gray)', fondo: 'var(--jb-pink-tint)', borde: 'var(--jb-pink-light)' }

              return (
                <button
                  key={orden.id}
                  onClick={() => abrirLlevar(orden)}
                  className="jb-fade-up"
                  style={{
                    background: estado.fondo, border: `2.5px solid ${estado.borde}`, borderRadius: 18,
                    padding: '14px 18px', cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'Inter Tight', sans-serif", display: 'flex', flexDirection: 'column', gap: 4,
                  }}
                >
                  <span className="flex items-center justify-between" style={{ gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--jb-ink)' }}>
                      L-{orden.folio} · {orden.clienteNombre}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--jb-ink-soft)' }}>
                      {minutosTranscurridos(orden.createdAt)}
                    </span>
                  </span>
                  <span className="flex items-center justify-between" style={{ gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: estado.color }}>{estado.texto}</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--jb-ink)' }}>
                      {f(totalDeOrden(orden, pedidos))}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
