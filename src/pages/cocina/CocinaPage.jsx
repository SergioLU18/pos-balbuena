import { useState } from 'react'
import { PedidoColumn } from '../../components/cocina/PedidoColumn'
import { EntregadosModal } from '../../components/cocina/EntregadosModal'
import { usePedidos } from '../../hooks/usePedidos'
import { useClock } from '../../hooks/useClock'

export default function CocinaPage() {
  const { nuevos, preparando, listos, entregados, avanzarEstado } = usePedidos()
  const hora = useClock()
  const [verEntregados, setVerEntregados] = useState(false)

  return (
    <div className="h-dvh w-full flex flex-col" style={{ background: 'var(--jb-cream)', fontFamily: "'Inter Tight', sans-serif" }}>
      <header
        className="flex items-center justify-between flex-shrink-0"
        style={{ padding: '14px 28px', background: 'var(--jb-pink)', boxShadow: '0 2px 12px var(--jb-shadow)' }}
      >
        <img src="/brand/logo-jardin-balbuena.webp" alt="Jardín Balbuena" style={{ height: 58, width: 'auto' }} />
        <div className="flex items-center" style={{ gap: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.18)', padding: '8px 16px', borderRadius: 12 }}>
            Cocina
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{hora}</span>
        </div>
      </header>

      <main className="flex-1 min-h-0" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, padding: 20 }}>
        <PedidoColumn titulo="Nuevos" color="var(--jb-pink)" pedidos={nuevos} onAvanzar={avanzarEstado} />
        <PedidoColumn titulo="Preparando" color="var(--jb-warn)" pedidos={preparando} onAvanzar={avanzarEstado} />
        <PedidoColumn titulo="Listos" color="var(--jb-ok)" pedidos={listos} onAvanzar={avanzarEstado} />
      </main>

      <button
        onClick={() => setVerEntregados(true)}
        aria-label="Ver comandas entregadas"
        title="Ver comandas entregadas"
        style={{
          position: 'fixed', right: 24, bottom: 24, width: 56, height: 56, borderRadius: '50%',
          background: 'var(--jb-ink)', color: '#fff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(51,34,42,0.35)',
        }}
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 12 12 17 22 12" />
          <polyline points="2 17 12 22 22 17" />
        </svg>
        {entregados.length > 0 && (
          <span
            style={{
              position: 'absolute', bottom: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
              background: 'rgba(255,255,255,0.94)', color: 'var(--jb-ink-soft)', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
            }}
          >
            {entregados.length}
          </span>
        )}
      </button>

      {verEntregados && <EntregadosModal pedidos={entregados} onClose={() => setVerEntregados(false)} />}
    </div>
  )
}
