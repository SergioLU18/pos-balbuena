import { useState } from 'react'
import { f } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { TierPicker } from './TierPicker'
import { MitadSwitch } from './MitadSwitch'
import { IngredienteChecklist } from './IngredienteChecklist'
import { ModificadorToggles } from './ModificadorToggles'
import { buildDraftItem, toggleDividido, setMitadField, calcItemPrecio } from '../../hooks/useOrderDraft'

const MITAD_LABEL = { completo: 'Ingredientes', izquierda: 'Mitad 1', derecha: 'Mitad 2' }

export function ConfigurarPlatilloModal({ platillo, ingredientes, modificadores, onConfirm, onClose }) {
  const [item, setItem] = useState(() => buildDraftItem(platillo, 0))

  function cambiarTier(tierIndex) {
    let next = buildDraftItem(platillo, tierIndex, item.tortillaId)
    if (item.dividido) next = toggleDividido(next)
    // conserva modificadores elegidos (no dependen del tier); los ingredientes se reinician
    // porque el máximo permitido puede cambiar con el nuevo nivel.
    next = { ...next, mitades: next.mitades.map((m, i) => ({ ...m, modificadores: item.mitades[i]?.modificadores ?? [] })) }
    setItem({ ...next, cantidad: item.cantidad, nota: item.nota })
  }

  function cambiarTortilla(tortillaId) {
    let next = buildDraftItem(platillo, item.tierIndex, tortillaId)
    if (item.dividido) next = toggleDividido(next)
    next = { ...next, mitades: next.mitades.map((m, i) => ({ ...m, modificadores: item.mitades[i]?.modificadores ?? [] })) }
    setItem({ ...next, cantidad: item.cantidad, nota: item.nota })
  }

  function toggleMitades() {
    setItem((it) => toggleDividido(it))
  }

  function cambiarMitad(lado, field, value) {
    setItem((it) => setMitadField(it, lado, field, value))
  }

  const precio = calcItemPrecio(item)

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
      }}
    >
      <div
        className="jb-pop"
        style={{
          background: '#fff', borderRadius: 26, width: 760, maxWidth: '100%', maxHeight: '92vh',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
        }}
      >
        <div className="no-scrollbar" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: 'var(--jb-ink)' }}>{platillo.nombre}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--jb-ink-soft)' }}>{platillo.base}</p>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'var(--jb-pink-light)', border: 'none', borderRadius: 12, width: 40, height: 40, fontSize: 18, fontWeight: 800, color: 'var(--jb-pink-dark)', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
            {platillo.tortillas && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
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
                      onChange={(v) => cambiarMitad(mitad.lado, 'ingredientes', v)}
                    />
                  )}
                  <ModificadorToggles
                    modificadores={modificadores}
                    seleccionados={mitad.modificadores}
                    onChange={(v) => cambiarMitad(mitad.lado, 'modificadores', v)}
                  />
                </div>
              ))}
            </div>

            {platillo.permiteNota && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)', margin: '0 0 8px' }}>Nota especial</p>
                <textarea
                  value={item.nota}
                  onChange={(e) => setItem((it) => ({ ...it, nota: e.target.value }))}
                  placeholder="Ej. sin picante, aparte la salsa..."
                  rows={2}
                  style={{
                    width: '100%', border: '2.5px solid var(--jb-line)', borderRadius: 14, padding: 14,
                    fontFamily: "'Inter Tight', sans-serif", fontSize: 15, resize: 'none', outline: 'none',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-between"
          style={{ padding: '20px 28px', borderTop: '2px solid var(--jb-line)', flexShrink: 0 }}
        >
          <div className="flex items-center" style={{ gap: 0, border: '2.5px solid var(--jb-line)', borderRadius: 14, overflow: 'hidden' }}>
            <button
              onClick={() => setItem((it) => ({ ...it, cantidad: Math.max(1, it.cantidad - 1) }))}
              style={{ width: 52, height: 52, border: 'none', background: 'var(--jb-cream)', fontSize: 24, fontWeight: 800, cursor: 'pointer' }}
            >−</button>
            <span style={{ width: 56, textAlign: 'center', fontSize: 20, fontWeight: 900 }}>{item.cantidad}</span>
            <button
              onClick={() => setItem((it) => ({ ...it, cantidad: it.cantidad + 1 }))}
              style={{ width: 52, height: 52, border: 'none', background: 'var(--jb-cream)', fontSize: 24, fontWeight: 800, cursor: 'pointer' }}
            >+</button>
          </div>
          <Button onClick={() => onConfirm(item)}>
            Agregar · {f(precio * item.cantidad)}
          </Button>
        </div>
      </div>
    </div>
  )
}
