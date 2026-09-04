import { useState } from 'react'
import { f } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { chipGrid } from '../ui/chipStyles'
import { TierPicker } from './TierPicker'
import { MitadSwitch } from './MitadSwitch'
import { IngredienteChecklist } from './IngredienteChecklist'
import { ModificadorToggles } from './ModificadorToggles'
import { ExtrasToggles } from './ExtrasToggles'
import { buildDraftItem, toggleDividido, setMitadField, calcItemPrecio } from '../../hooks/useOrderDraft'

const MITAD_LABEL = { completo: 'Ingredientes', izquierda: 'Mitad 1', derecha: 'Mitad 2' }

// Reconstruye un renglón a partir del platillo actual del menú (para que el tier
// tome precios frescos) y le vuelve a poner lo que el mesero ya había elegido.
function rehidratarItem(platillo, prev) {
  let base = buildDraftItem(platillo, prev.tierIndex ?? 0, prev.tortillaId)
  if (prev.dividido) base = toggleDividido(base)
  return {
    ...base,
    id: prev.id ?? base.id,
    mitades: base.mitades.map((m, i) => ({
      ...m,
      ingredientes: prev.mitades?.[i]?.ingredientes ?? [],
      modificadores: prev.mitades?.[i]?.modificadores ?? [],
    })),
    extras: prev.extras ?? [],
    cantidad: prev.cantidad ?? 1,
    nota: prev.nota ?? '',
  }
}

export function ConfigurarPlatilloModal({ platillo, ingredientes, modificadores, extras = [], itemInicial = null, onConfirm, onClose }) {
  const editando = itemInicial != null
  const [item, setItem] = useState(() => (editando ? rehidratarItem(platillo, itemInicial) : buildDraftItem(platillo, 0)))
  const [error, setError] = useState(null)

  function cambiarTier(tierIndex) {
    setError(null)
    let next = buildDraftItem(platillo, tierIndex, item.tortillaId)
    if (item.dividido) next = toggleDividido(next)
    // conserva modificadores elegidos (no dependen del tier); los ingredientes se reinician
    // porque el máximo permitido puede cambiar con el nuevo nivel. Los extras (nivel
    // platillo) también se conservan.
    next = { ...next, mitades: next.mitades.map((m, i) => ({ ...m, modificadores: item.mitades[i]?.modificadores ?? [] })) }
    setItem({ ...next, cantidad: item.cantidad, nota: item.nota, extras: item.extras })
  }

  function cambiarTortilla(tortillaId) {
    setError(null)
    let next = buildDraftItem(platillo, item.tierIndex, tortillaId)
    if (item.dividido) next = toggleDividido(next)
    next = { ...next, mitades: next.mitades.map((m, i) => ({ ...m, modificadores: item.mitades[i]?.modificadores ?? [] })) }
    setItem({ ...next, cantidad: item.cantidad, nota: item.nota, extras: item.extras })
  }

  function toggleMitades() {
    setError(null)
    setItem((it) => toggleDividido(it))
  }

  function cambiarMitad(lado, field, value) {
    setError(null)
    setItem((it) => setMitadField(it, lado, field, value))
  }

  // Cada mitad debe llegar al número de ingredientes que pide el nivel elegido.
  function intentarAgregar() {
    const requeridos = item.tier.ingredientes
    if (requeridos > 0) {
      const incompletas = item.mitades.filter((m) => (m.ingredientes?.length ?? 0) < requeridos)
      if (incompletas.length) {
        const n = requeridos
        const cuantos = `${n} ${n === 1 ? 'ingrediente' : 'ingredientes'}`
        setError(
          item.dividido
            ? `Elige ${cuantos} en cada mitad antes de agregar.`
            : `Elige ${cuantos} antes de agregar (llevas ${item.mitades[0].ingredientes.length}).`,
        )
        return
      }
    }
    onConfirm(item)
  }

  const precio = calcItemPrecio(item)

  // Solo los modificadores y extras que este platillo declara (el sitio real los
  // asocia por platillo: una quesadilla no tiene frijol que quitar, una bebida no
  // lleva extras de comida). modificadores == null => todos (platillo heredado sin
  // lista); extras == null => ninguno (evita mostrar extras de comida donde no aplican).
  const modsAplicables = platillo.modificadores == null
    ? modificadores
    : modificadores.filter((m) => platillo.modificadores.includes(m))
  const extrasAplicables = platillo.extras == null
    ? []
    : extras.filter((e) => platillo.extras.includes(e.nombre))

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
          background: '#fff', borderRadius: 26, width: 760, maxWidth: '100%', maxHeight: '92vh',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
        }}
      >
        <div style={{ padding: '24px 28px 20px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '2px solid var(--jb-line)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: 'var(--jb-ink)' }}>
              {editando ? `Editar · ${platillo.nombre}` : platillo.nombre}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--jb-ink-soft)' }}>{platillo.base}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'var(--jb-pink-light)', border: 'none', borderRadius: 14, width: 52, height: 52, flexShrink: 0, fontSize: 22, fontWeight: 800, color: 'var(--jb-pink-dark)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {platillo.tortillas && (
            <div style={chipGrid}>
              {platillo.tortillas.map((t) => (
                <Chip key={t.id} active={item.tortillaId === t.id} onClick={() => cambiarTortilla(t.id)}>
                  {t.nombre}
                </Chip>
              ))}
            </div>
          )}

          <TierPicker
            tiers={platillo.tortillas ? platillo.tortillas.find((t) => t.id === item.tortillaId).tiers : platillo.tiers}
            selectedIndex={item.tierIndex}
            onSelect={cambiarTier}
          />

          {platillo.permiteMitades && <MitadSwitch dividido={item.dividido} onToggle={toggleMitades} />}

          <div style={{ display: 'grid', gridTemplateColumns: item.dividido ? '1fr 1fr' : '1fr', gap: 20 }}>
            {item.mitades.map((mitad) => (
              <div
                key={mitad.lado}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 16,
                  ...(item.dividido && { padding: 16, border: '2px dashed var(--jb-line)', borderRadius: 16 }),
                }}
              >
                {item.dividido && (
                  <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--jb-pink-dark)' }}>{MITAD_LABEL[mitad.lado]}</span>
                )}
                {item.tier.ingredientes > 0 && (
                  <IngredienteChecklist
                    ingredientes={ingredientes}
                    seleccionados={mitad.ingredientes}
                    max={item.tier.ingredientes}
                    resaltarFalta={!!error}
                    onChange={(v) => cambiarMitad(mitad.lado, 'ingredientes', v)}
                  />
                )}
                <ModificadorToggles
                  modificadores={modsAplicables}
                  seleccionados={mitad.modificadores}
                  onChange={(v) => cambiarMitad(mitad.lado, 'modificadores', v)}
                />
              </div>
            ))}
          </div>

          <ExtrasToggles
            extras={extrasAplicables}
            seleccionados={item.extras}
            onChange={(v) => setItem((it) => ({ ...it, extras: v }))}
          />

          {platillo.permiteNota && (
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--jb-ink-soft)', margin: '0 0 10px' }}>Nota especial</p>
              <textarea
                value={item.nota}
                onChange={(e) => setItem((it) => ({ ...it, nota: e.target.value }))}
                placeholder="Ej. sin picante, aparte la salsa..."
                rows={2}
                style={{
                  width: '100%', border: '2.5px solid var(--jb-line)', borderRadius: 14, padding: 14,
                  fontFamily: "'Inter Tight', sans-serif", fontSize: 16, resize: 'none', outline: 'none',
                }}
              />
            </div>
          )}

        </div>

        <div
          style={{
            flexShrink: 0, borderTop: '2px solid var(--jb-line)', background: '#fff',
            padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          {error && (
            <p
              role="alert"
              style={{
                margin: 0, padding: '10px 14px', borderRadius: 12,
                background: '#F6E7E7', color: '#C24A4A',
                fontSize: 15, fontWeight: 800, textAlign: 'center',
              }}
            >
              {error}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="flex items-center" style={{ gap: 0, border: '2.5px solid var(--jb-line)', borderRadius: 16, overflow: 'hidden', flexShrink: 0 }}>
              <button
                onClick={() => setItem((it) => ({ ...it, cantidad: Math.max(1, it.cantidad - 1) }))}
                aria-label="Quitar uno"
                style={{ width: 60, height: 64, border: 'none', background: 'var(--jb-cream)', fontSize: 28, fontWeight: 800, cursor: 'pointer' }}
              >−</button>
              <span style={{ width: 52, textAlign: 'center', fontSize: 22, fontWeight: 900 }}>{item.cantidad}</span>
              <button
                onClick={() => setItem((it) => ({ ...it, cantidad: it.cantidad + 1 }))}
                aria-label="Agregar uno"
                style={{ width: 60, height: 64, border: 'none', background: 'var(--jb-cream)', fontSize: 28, fontWeight: 800, cursor: 'pointer' }}
              >+</button>
            </div>
            <Button onClick={intentarAgregar} style={{ flex: 1, minHeight: 68, fontSize: 21 }}>
              {editando ? 'Guardar cambios' : 'Agregar'} · {f(precio * item.cantidad)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
