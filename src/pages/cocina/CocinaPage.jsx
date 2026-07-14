import { PedidoColumn } from '../../components/cocina/PedidoColumn'
import { usePedidos } from '../../hooks/usePedidos'
import { useClock } from '../../hooks/useClock'

export default function CocinaPage() {
  const { nuevos, preparando, listos, avanzarEstado } = usePedidos()
  const hora = useClock()

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
    </div>
  )
}
