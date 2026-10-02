import { useState } from 'react'
import { f } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { chipGrid } from '../ui/chipStyles'
import { TierPicker } from './TierPicker'
import { IngredienteChecklist } from './IngredienteChecklist'
import { ModificadorToggles } from './ModificadorToggles'
import { ExtrasToggles, ExtraLibreForm } from './ExtrasToggles'
import { buildDraftItem, setMitadField, calcItemPrecio } from '../../hooks/useOrderDraft'
import { EMPAQUE_MONTO, conEmpaque } from '../../lib/empaque'

// Reconstruye un renglón a partir del platillo actual del menú (para que el tier
// tome precios frescos) y le vuelve a poner lo que el mesero ya había elegido.
function rehidratarItem(platillo, prev) {
  const base = buildDraftItem(platillo, prev.tierIndex ?? 0, prev.tortillaId)
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

// `permiteParaLlevar`: solo en una MESA, donde un platillo suelto puede pedirse para
// llevar (+$5 del desechable). En una orden para llevar no se ofrece: ahí todo lleva
// empaque y el tupper se elige en el ticket (ver useOrdenLlevar).
export function ConfigurarPlatilloModal({ platillo, ingredientes, modificadores, extras = [], itemInicial = null, permiteParaLlevar = false, onConfirm, onClose }) {
  const editando = itemInicial != null
  // Estado aparte y no dentro de `item`: cambiar de tier o de tortilla reconstruye el
  // renglón desde cero, y se llevaría la marca con él.
  const [paraLlevar, setParaLlevar] = useState(itemInicial?.empaque != null)
  const [item, setItem] = useState(() => (editando ? rehidratarItem(platillo, itemInicial) : buildDraftItem(platillo, 0)))
  const [error, setError] = useState(null)

  function cambiarTier(tierIndex) {
    setError(null)
    let next = buildDraftItem(platillo, tierIndex, item.tortillaId)
    // conserva modificadores elegidos (no dependen del tier); los ingredientes se reinician
    // porque el máximo permitido puede cambiar con el nuevo nivel. Los extras (nivel
    // platillo) también se conservan.
    next = { ...next, mitades: next.mitades.map((m, i) => ({ ...m, modificadores: item.mitades[i]?.modificadores ?? [] })) }
    setItem({ ...next, cantidad: item.cantidad, nota: item.nota, extras: item.extras })
  }

  function cambiarTortilla(tortillaId) {
    setError(null)
    let next = buildDraftItem(platillo, item.tierIndex, tortillaId)
    next = { ...next, mitades: next.mitades.map((m, i) => ({ ...m, modificadores: item.mitades[i]?.modificadores ?? [] })) }
    setItem({ ...next, cantidad: item.cantidad, nota: item.nota, extras: item.extras })
  }

  // El renglón guarda su personalización en `mitades` (heredado de cuando el platillo
  // se podía dividir); ahora siempre trae exactamente una, con lado 'completo'.
  const mitad = item.mitades[0]

  function cambiarMitad(field, value) {
    setError(null)
    setItem((it) => setMitadField(it, mitad.lado, field, value))
  }

  function intentarAgregar() {
    const requeridos = item.tier.ingredientes
    if (requeridos > 0 && mitad.ingredientes.length < requeridos) {
      const n = requeridos
      const cuantos = `${n} ${n === 1 ? 'ingrediente' : 'ingredientes'}`
      setError(`Elige ${cuantos} antes de agregar (llevas ${mitad.ingredientes.length}).`)
      return
    }
    onConfirm(conPara(item))
  }

  // Con permiteParaLlevar el renglón sale SIEMPRE con su empaque resuelto (puesto o
  // quitado), para que reeditar uno que iba para llevar y desmarcarlo sí lo quite.
  const conPara = (it) => (permiteParaLlevar ? conEmpaque(it, paraLlevar ? 'plastico' : null) : it)
  const precio = calcItemPrecio(conPara(item))

  // Solo los modificadores y extras de CATÁLOGO que este platillo declara (el sitio real
  // los asocia por platillo: una quesadilla no tiene frijol que quitar, una bebida no
  // lleva extras de comida). En ambos casos, == null => todos (platillo heredado sin
  // lista), igual que arranca el formulario de admin al editar un platillo nuevo.
  // El campo de extra libre que trae ExtrasToggles no pasa por esta allowlist: se ofrece
  // en todos los platillos, incluidos los que no tienen ningún extra de catálogo.
  // Con el interruptor general apagado (usaModificadores/usaExtras === false), la
  // sección entera se oculta sin importar la allowlist de arriba.
  const modsAplicables = platillo.usaModificadores === false
    ? []
    : platillo.modificadores == null
      ? modificadores
      : modificadores.filter((m) => platillo.modificadores.includes(m))
  const extrasAplicables = platillo.usaExtras === false
    ? []
    : platillo.extras == null
      ? extras
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {item.tier.ingredientes > 0 && (
              <IngredienteChecklist
                ingredientes={ingredientes}
                seleccionados={mitad.ingredientes}
                max={item.tier.ingredientes}
                resaltarFalta={!!error}
                onChange={(v) => cambiarMitad('ingredientes', v)}
              />
            )}
            <ExtrasToggles
              extras={extrasAplicables}
              seleccionados={item.extras}
              onChange={(v) => setItem((it) => ({ ...it, extras: v }))}
            />
            <ModificadorToggles
              modificadores={modsAplicables}
              seleccionados={mitad.modificadores}
              onChange={(v) => cambiarMitad('modificadores', v)}
            />
          </div>

          {platillo.usaExtras !== false && (
            <ExtraLibreForm
              seleccionados={item.extras}
              onChange={(v) => setItem((it) => ({ ...it, extras: v }))}
            />
          )}

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
          {permiteParaLlevar && (
            <button
              aria-pressed={paraLlevar}
              onClick={() => setParaLlevar((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                fontFamily: "'Inter Tight', sans-serif", fontSize: 17, fontWeight: 800,
                border: `2.5px solid ${paraLlevar ? 'var(--jb-pink)' : 'var(--jb-line)'}`,
                background: paraLlevar ? 'var(--jb-pink-light)' : '#fff',
                color: paraLlevar ? 'var(--jb-pink-dark)' : 'var(--jb-ink-soft)',
              }}
            >
              <span>{paraLlevar ? '☑' : '☐'} 🥡 Para llevar</span>
              <span>+{f(EMPAQUE_MONTO)} c/u</span>
            </button>
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
