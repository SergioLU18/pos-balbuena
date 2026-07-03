import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MESAS } from '../../lib/mockMesas'
import { useMenu } from '../../hooks/useMenu'
import { useOrderDraft } from '../../hooks/useOrderDraft'
import { CategoriaGrid } from '../../components/mesero/CategoriaGrid'
import { PlatilloCard } from '../../components/mesero/PlatilloCard'
import { ConfigurarPlatilloModal } from '../../components/mesero/ConfigurarPlatilloModal'
import { OrderTicket } from '../../components/mesero/OrderTicket'

export default function MeseroOrdenPage() {
  const { mesaId } = useParams()
  const navigate = useNavigate()
  const mesa = MESAS.find((m) => m.id === mesaId)
  const { menu, categorias, ingredientes, modificadores } = useMenu()
  // null = paso 1 (categorías a pantalla completa); string = paso 2 (platillos de esa categoría)
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [platilloEnConfig, setPlatilloEnConfig] = useState(null)

  const {
    draft, cuenta, subtotalDraft, subtotalCuenta,
    agregarItemConstruido, cambiarCantidad, quitarItem, enviarACocina, cerrarMesa,
  } = useOrderDraft(mesaId)

  const platillosCategoria = menu.filter((p) => p.categoria === categoriaActiva)

  function confirmarPlatillo(item) {
    agregarItemConstruido(item)
    setPlatilloEnConfig(null)
  }

  // TEMPORAL: botón manual para cerrar la mesa mientras no exista el cierre real
  // desde la app de pagos. Se quitará cuando esa integración esté lista.
  function handleCerrarMesa() {
    if (!window.confirm(`¿Cerrar la Mesa ${mesa?.numero}? Esto libera la mesa para una nueva cuenta.`)) return
    cerrarMesa()
    navigate('/mesero')
  }

  return (
    <div className="h-full flex flex-col" style={{ padding: '20px 28px' }}>
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
          Mesa {mesa?.numero ?? '—'}{categoriaActiva ? ` · ${categoriaActiva}` : ''}
        </h1>

        {cuenta && (
          <button
            onClick={handleCerrarMesa}
            title="Temporal: cerrará cuando exista el cierre real desde la app de pagos"
            style={{
              fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 700,
              padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
              background: '#fff', border: '2px solid #E0B4B4', color: '#A83232',
            }}
          >
            Cerrar mesa (temporal)
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) 380px', gap: 20 }}>
        <div className="flex flex-col min-h-0 min-w-0" style={{ gap: 4 }}>
          <div className={categoriaActiva === null ? 'flex-1 min-h-0' : 'flex-shrink-0'}>
            <CategoriaGrid
              categorias={categorias}
              activa={categoriaActiva}
              onSelect={setCategoriaActiva}
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
          subtotalDraft={subtotalDraft}
          subtotalCuenta={subtotalCuenta}
          onQty={cambiarCantidad}
          onRemove={quitarItem}
          onEnviar={enviarACocina}
        />
      </div>

      {platilloEnConfig && (
        <ConfigurarPlatilloModal
          platillo={platilloEnConfig}
          ingredientes={ingredientes}
          modificadores={modificadores}
          onConfirm={confirmarPlatillo}
          onClose={() => setPlatilloEnConfig(null)}
        />
      )}
    </div>
  )
}
