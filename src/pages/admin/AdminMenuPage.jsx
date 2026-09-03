import { useState } from 'react'
import { usePosStore } from '../../store/appStore'
import { useMenuAdmin } from '../../hooks/useMenuAdmin'
import { f, uid } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { ModalShell, Campo, Toggle } from '../../components/admin/AdminModal'
import { inputStyle } from '../../components/admin/adminStyles'

// Editor de menú: platillos (con niveles de precio y variantes de tortilla),
// ingredientes globales y modificadores de remoción. Tres sub-pestañas.
export default function AdminMenuPage() {
  const [tab, setTab] = useState('platillos')

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 24px 60px' }}>
      <div className="flex" style={{ gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        <SubTab active={tab === 'platillos'} onClick={() => setTab('platillos')}>Platillos</SubTab>
        <SubTab active={tab === 'ingredientes'} onClick={() => setTab('ingredientes')}>Ingredientes</SubTab>
        <SubTab active={tab === 'modificadores'} onClick={() => setTab('modificadores')}>Modificadores</SubTab>
        <SubTab active={tab === 'extras'} onClick={() => setTab('extras')}>Extras</SubTab>
      </div>

      {tab === 'platillos' && <PlatillosTab />}
      {tab === 'ingredientes' && <IngredientesTab />}
      {tab === 'modificadores' && <ModificadoresTab />}
      {tab === 'extras' && <ExtrasTab />}
    </div>
  )
}

function SubTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 15,
        padding: '13px 20px', minHeight: 46, borderRadius: 12, cursor: 'pointer',
        border: active ? '2.5px solid var(--jb-pink)' : '2.5px solid var(--jb-line)',
        background: active ? 'var(--jb-pink-tint)' : '#fff',
        color: active ? 'var(--jb-pink-dark)' : 'var(--jb-ink)',
      }}
    >
      {children}
    </button>
  )
}

// ── Platillos ────────────────────────────────────────────────────────────────
function preciosDe(p) {
  const tiers = p.tortillas ? p.tortillas.flatMap((t) => t.tiers) : (p.tiers ?? [])
  return tiers.map((t) => Number(t.precio)).filter((n) => !isNaN(n))
}

// Bebidas y Postres siempre al final (en ese orden); el resto, alfabético.
const CATEGORIAS_AL_FINAL = ['Postres', 'Bebidas']
function ordenarCategorias(cats) {
  const cola = CATEGORIAS_AL_FINAL.filter((c) => cats.includes(c))
  const resto = cats.filter((c) => !CATEGORIAS_AL_FINAL.includes(c)).sort((a, b) => a.localeCompare(b, 'es'))
  return [...resto, ...cola]
}

function PlatillosTab() {
  const platillos = usePosStore((s) => s.platillos)
  const { guardarPlatillo, borrarPlatillo } = useMenuAdmin()
  const [viendo, setViendo] = useState(null)
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)

  const categorias = ordenarCategorias([...new Set(platillos.map((p) => p.categoria || 'Sin categoría'))])
  const platillosOrdenados = categorias.flatMap((cat) =>
    platillos.filter((p) => (p.categoria || 'Sin categoría') === cat),
  )
  // La etiqueta de categoría en la tarjeta solo se muestra si la categoría agrupa
  // 2 o más platillos; si solo tiene uno, no aporta y se omite.
  const conteoPorCategoria = platillos.reduce((acc, p) => {
    const c = p.categoria || 'Sin categoría'
    acc[c] = (acc[c] || 0) + 1
    return acc
  }, {})

  async function confirmarBorrado() {
    const p = borrando
    setBorrando(null)
    setEditando(null)
    await borrarPlatillo(p.id)
  }

  return (
    <>
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--jb-ink-soft)' }}>
          {platillos.length} {platillos.length === 1 ? 'platillo' : 'platillos'}
        </p>
        <Button size="md" onClick={() => setEditando({})}>+ Nuevo platillo</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, alignItems: 'start' }}>
        {platillosOrdenados.map((p) => {
          const precios = preciosDe(p)
          const inactivo = p.activo === false
          const min = precios.length ? Math.min(...precios) : 0
          const max = precios.length ? Math.max(...precios) : 0
          return (
            <div key={p.id} style={{
              background: '#fff', border: '3px solid var(--jb-line)', borderRadius: 18,
              padding: '14px 18px 16px', display: 'flex', flexDirection: 'column', gap: 4, opacity: inactivo ? 0.55 : 1,
            }}>
              {conteoPorCategoria[p.categoria || 'Sin categoría'] > 1 && (
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--jb-pink-dark)' }}>
                  {p.categoria || 'Sin categoría'}
                </span>
              )}
              <div className="flex items-center justify-between" style={{ gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--jb-ink)' }}>{p.nombre}</span>
                {inactivo && <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: 'var(--jb-gray)', padding: '3px 9px', borderRadius: 999 }}>Oculto</span>}
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--jb-pink-dark)' }}>
                {precios.length === 0 ? '—' : min === max ? f(min) : `${f(min)} – ${f(max)}`}
              </span>
              <div className="flex" style={{ gap: 8, marginTop: 6 }}>
                <Button variant="secondary" size="md" style={{ flex: 1 }} onClick={() => setViendo(p)}>Ver</Button>
                <Button variant="ghost" size="md" style={{ color: 'var(--jb-pink-dark)' }} onClick={() => setEditando(p)}>Editar</Button>
              </div>
            </div>
          )
        })}
      </div>

      {viendo && <PlatilloVistaModal platillo={viendo} onClose={() => setViendo(null)} />}
      {editando && (
        <PlatilloModal
          platillo={editando}
          categoriasExistentes={[...new Set(platillos.map((p) => p.categoria).filter(Boolean))]}
          onGuardar={guardarPlatillo}
          onBorrar={() => setBorrando(editando)}
          onClose={() => setEditando(null)}
        />
      )}
      {borrando && (
        <ConfirmModal
          titulo={`¿Borrar ${borrando.nombre}?`}
          mensaje="Se quita del menú. Las cuentas que ya lo incluyen conservan su nombre y precio."
          confirmarLabel="Borrar platillo"
          danger
          onConfirm={confirmarBorrado}
          onClose={() => setBorrando(null)}
        />
      )}
    </>
  )
}

function PlatilloModal({ platillo, categoriasExistentes, onGuardar, onBorrar, onClose }) {
  const esNuevo = !platillo.id
  const [nombre, setNombre] = useState(platillo.nombre ?? '')
  const [categoria, setCategoria] = useState(platillo.categoria ?? '')
  const [base, setBase] = useState(platillo.base ?? '')
  const [usaTortillas, setUsaTortillas] = useState(!!platillo.tortillas)
  const [tiers, setTiers] = useState(platillo.tiers?.length ? platillo.tiers : [{ nombre: 'Sencillo', ingredientes: 0, precio: '' }])
  const [tortillas, setTortillas] = useState(platillo.tortillas ?? [{ id: uid('tor'), nombre: '', tiers: [{ nombre: '1 Ingrediente', ingredientes: 1, precio: '' }] }])
  const [permiteMitades, setPermiteMitades] = useState(!!platillo.permiteMitades)
  const [permiteNota, setPermiteNota] = useState(!!platillo.permiteNota)
  const [activo, setActivo] = useState(platillo.activo !== false)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  function normalizarTiers(list) {
    return list
      .map((t) => ({ nombre: t.nombre?.trim() || 'Nivel', ingredientes: Number(t.ingredientes) || 0, precio: Number(t.precio) || 0 }))
  }

  async function guardar() {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }

    let payloadTiers = []
    let payloadTortillas = null
    if (usaTortillas) {
      const limpias = tortillas
        .filter((t) => t.nombre?.trim() && t.tiers?.length)
        .map((t) => ({ id: t.id || uid('tor'), nombre: t.nombre.trim(), tiers: normalizarTiers(t.tiers) }))
      if (limpias.length === 0) { setError('Agrega al menos una variante de tortilla con un nivel.'); return }
      payloadTortillas = limpias
    } else {
      if (tiers.length === 0 || tiers.every((t) => t.precio === '' || t.precio == null)) {
        setError('Agrega al menos un nivel con precio.'); return
      }
      payloadTiers = normalizarTiers(tiers.filter((t) => t.precio !== '' && t.precio != null))
    }

    setGuardando(true)
    const { error: err } = await onGuardar({
      id: platillo.id,
      nombre: nombre.trim(),
      categoria: categoria.trim(),
      base: base.trim(),
      tiers: payloadTiers,
      tortillas: payloadTortillas,
      permiteMitades,
      permiteNota,
      activo,
    })
    setGuardando(false)
    if (err) { setError(err); return }
    onClose()
  }

  return (
    <ModalShell width={640} titulo={esNuevo ? 'Nuevo platillo' : `Editar ${platillo.nombre}`} onClose={onClose}>
      <Campo label="Nombre">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} placeholder="Ej. Sope" />
      </Campo>

      <Campo label="Categoría">
        <input list="cats-existentes" value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle} placeholder="Ej. Sopes" />
        <datalist id="cats-existentes">
          {categoriasExistentes.map((c) => <option key={c} value={c} />)}
        </datalist>
      </Campo>

      <Campo label="Ingredientes base (texto descriptivo)">
        <textarea value={base} onChange={(e) => setBase(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'none' }} placeholder="Tortilla hecha a mano, frijol, crema…" />
      </Campo>

      <Toggle checked={usaTortillas} onChange={setUsaTortillas} label="Usa variantes de tortilla (precio por tipo de tortilla)" />

      {usaTortillas ? (
        <TortillasEditor tortillas={tortillas} onChange={setTortillas} />
      ) : (
        <Campo label="Niveles de precio">
          <TiersEditor tiers={tiers} onChange={setTiers} />
        </Campo>
      )}

      <div className="flex" style={{ gap: 20, flexWrap: 'wrap' }}>
        <Toggle checked={permiteMitades} onChange={setPermiteMitades} label="Permite mitades" />
        <Toggle checked={permiteNota} onChange={setPermiteNota} label="Permite nota" />
        <Toggle checked={activo} onChange={setActivo} label="Disponible en el menú" />
      </div>

      {error && <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#C24A4A' }}>{error}</p>}

      <div className="flex" style={{ gap: 12, marginTop: 6 }}>
        <Button variant="secondary" size="md" style={{ flex: 1 }} onClick={onClose}>Cancelar</Button>
        <Button size="md" style={{ flex: 1 }} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
      </div>

      {!esNuevo && onBorrar && (
        <button onClick={onBorrar} style={borrarBtn}>Borrar platillo</button>
      )}
    </ModalShell>
  )
}

// Vista de solo lectura de un platillo (botón "Ver"): muestra todo sin editar.
function PlatilloVistaModal({ platillo, onClose }) {
  const grupos = platillo.tortillas?.length
    ? platillo.tortillas.map((t) => ({ titulo: t.nombre, tiers: t.tiers ?? [] }))
    : [{ titulo: null, tiers: platillo.tiers ?? [] }]

  return (
    <ModalShell width={560} titulo={platillo.nombre} onClose={onClose}>
      <Campo label="Categoría">
        <div style={valorLeer}>{platillo.categoria || 'Sin categoría'}</div>
      </Campo>

      <Campo label="Ingredientes base">
        <div style={valorLeer}>{platillo.base?.trim() || '—'}</div>
      </Campo>

      <Campo label="Niveles de precio">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grupos.map((g, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.titulo && (
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--jb-pink-dark)' }}>{g.titulo}</span>
              )}
              {g.tiers.length === 0 && <span style={{ fontSize: 14, color: 'var(--jb-gray)' }}>Sin niveles</span>}
              {g.tiers.map((t, j) => (
                <div key={j} className="flex items-center justify-between" style={{
                  border: '2px solid var(--jb-line)', borderRadius: 12, padding: '10px 14px',
                }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--jb-ink)' }}>
                    {t.nombre}
                    <span style={{ fontWeight: 600, color: 'var(--jb-gray)', marginLeft: 8 }}>
                      {Number(t.ingredientes) > 0 ? `${t.ingredientes} ing.` : 'sin ingredientes'}
                    </span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--jb-pink-dark)' }}>{f(Number(t.precio) || 0)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Campo>

      <div className="flex" style={{ gap: 16, flexWrap: 'wrap' }}>
        <BanderaVista ok={!!platillo.permiteMitades}>Permite mitades</BanderaVista>
        <BanderaVista ok={!!platillo.permiteNota}>Permite nota</BanderaVista>
        <BanderaVista ok={platillo.activo !== false}>Disponible en el menú</BanderaVista>
      </div>

      <div className="flex" style={{ marginTop: 6 }}>
        <Button variant="secondary" size="md" style={{ flex: 1 }} onClick={onClose}>Cerrar</Button>
      </div>
    </ModalShell>
  )
}

function BanderaVista({ ok, children }) {
  return (
    <span style={{ fontSize: 14, fontWeight: 700, color: ok ? 'var(--jb-ink)' : 'var(--jb-gray)' }}>
      {ok ? '✓' : '✕'} {children}
    </span>
  )
}

function TiersEditor({ tiers, onChange, hint = true }) {
  function set(i, patch) { onChange(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t))) }
  function add() { onChange([...tiers, { nombre: '', ingredientes: tiers.length, precio: '' }]) }
  function remove(i) { onChange(tiers.filter((_, j) => j !== i)) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        <span style={{ flex: 2 }} />
        <span style={{ ...colHead, width: 80, flex: 'none', textAlign: 'center' }}># Ingr.</span>
        <span style={{ ...colHead, flex: 1, textAlign: 'center' }}>Precio</span>
        <span style={{ width: 46, flexShrink: 0 }} />
      </div>
      {tiers.map((t, i) => (
        <div key={i} className="flex items-center" style={{ gap: 8 }}>
          <input value={t.nombre} onChange={(e) => set(i, { nombre: e.target.value })} placeholder="Ej. 2 Ingredientes" style={{ ...inputStyle, flex: 2 }} />
          <input value={t.ingredientes} onChange={(e) => set(i, { ingredientes: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="0" title="Cuántos ingredientes puede elegir el mesero en este nivel" style={{ ...inputStyle, width: 80, flex: 'none', textAlign: 'center' }} />
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 12, top: 13, color: 'var(--jb-gray)', fontSize: 15 }}>$</span>
            <input value={t.precio} onChange={(e) => set(i, { precio: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder="0" style={{ ...inputStyle, paddingLeft: 24 }} />
          </div>
          <button onClick={() => remove(i)} title="Quitar nivel" style={quitarBtn}>✕</button>
        </div>
      ))}
      {hint && (
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--jb-gray)', lineHeight: 1.4 }}>
          <b># Ingr.</b> = cuántos ingredientes puede elegir el mesero en ese nivel (0 = ninguno, no aparece la lista).
        </p>
      )}
      <button onClick={add} style={agregarBtn}>+ Agregar nivel</button>
    </div>
  )
}

function TortillasEditor({ tortillas, onChange }) {
  function setTor(i, patch) { onChange(tortillas.map((t, j) => (j === i ? { ...t, ...patch } : t))) }
  function addTor() { onChange([...tortillas, { id: uid('tor'), nombre: '', tiers: [{ nombre: '1 Ingrediente', ingredientes: 1, precio: '' }] }]) }
  function removeTor(i) { onChange(tortillas.filter((_, j) => j !== i)) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--jb-gray)', lineHeight: 1.4 }}>
        <b># Ingr.</b> = cuántos ingredientes puede elegir el mesero en ese nivel (0 = ninguno, no aparece la lista).
      </p>
      {tortillas.map((t, i) => (
        <div key={t.id ?? i} style={{ border: '2px dashed var(--jb-line)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <input value={t.nombre} onChange={(e) => setTor(i, { nombre: e.target.value })} placeholder="Tortilla de Maíz" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => removeTor(i)} title="Quitar tortilla" style={quitarBtn}>✕</button>
          </div>
          <TiersEditor tiers={t.tiers} onChange={(nt) => setTor(i, { tiers: nt })} hint={false} />
        </div>
      ))}
      <button onClick={addTor} style={agregarBtn}>+ Agregar variante de tortilla</button>
    </div>
  )
}

// ── Ingredientes ─────────────────────────────────────────────────────────────
function IngredientesTab() {
  const ingredientes = usePosStore((s) => s.ingredientes)
  const { guardarIngrediente, borrarIngrediente } = useMenuAdmin()
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)

  return (
    <>
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--jb-ink-soft)' }}>Ingredientes disponibles para personalizar platillos.</p>
        <Button size="md" onClick={() => setEditando({})}>+ Nuevo</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {ingredientes.map((i) => (
          <FilaSimple
            key={i.id}
            nombre={i.nombre}
            sub={i.extra > 0 ? `+${f(i.extra)}` : 'Sin cargo'}
            inactivo={i.activo === false}
            onEdit={() => setEditando(i)}
            onDelete={() => setBorrando(i)}
          />
        ))}
      </div>
      {editando && (
        <ItemSimpleModal
          titulo={editando.id ? 'Editar ingrediente' : 'Nuevo ingrediente'}
          item={editando}
          precioField="extra"
          precioLabel="Cargo extra (MXN)"
          onGuardar={guardarIngrediente}
          onClose={() => setEditando(null)}
        />
      )}
      {borrando && (
        <ConfirmModal titulo={`¿Borrar ${borrando.nombre}?`} confirmarLabel="Borrar" danger
          onConfirm={async () => { const x = borrando; setBorrando(null); await borrarIngrediente(x.id) }}
          onClose={() => setBorrando(null)} />
      )}
    </>
  )
}

// ── Modificadores ────────────────────────────────────────────────────────────
function ModificadoresTab() {
  const modificadores = usePosStore((s) => s.modificadores)
  const { guardarModificador, borrarModificador } = useMenuAdmin()
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)

  return (
    <>
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--jb-ink-soft)' }}>Modificadores de remoción ("Sin crema", "Sin frijol"…).</p>
        <Button size="md" onClick={() => setEditando({})}>+ Nuevo</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {modificadores.map((m) => (
          <FilaSimple
            key={m.id}
            nombre={m.nombre}
            inactivo={m.activo === false}
            onEdit={() => setEditando(m)}
            onDelete={() => setBorrando(m)}
          />
        ))}
      </div>
      {editando && (
        <ItemSimpleModal
          titulo={editando.id ? 'Editar modificador' : 'Nuevo modificador'}
          item={editando}
          onGuardar={guardarModificador}
          onClose={() => setEditando(null)}
        />
      )}
      {borrando && (
        <ConfirmModal titulo={`¿Borrar ${borrando.nombre}?`} confirmarLabel="Borrar" danger
          onConfirm={async () => { const x = borrando; setBorrando(null); await borrarModificador(x.id) }}
          onClose={() => setBorrando(null)} />
      )}
    </>
  )
}

// ── Extras (agregados de pago) ───────────────────────────────────────────────
function ExtrasTab() {
  const extras = usePosStore((s) => s.extras)
  const { guardarExtra, borrarExtra } = useMenuAdmin()
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)

  return (
    <>
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--jb-ink-soft)' }}>Agregados de pago disponibles en todos los platillos.</p>
        <Button size="md" onClick={() => setEditando({})}>+ Nuevo</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {extras.map((x) => (
          <FilaSimple
            key={x.id}
            nombre={x.nombre}
            sub={x.precio > 0 ? `+${f(x.precio)}` : 'Sin cargo'}
            inactivo={x.activo === false}
            onEdit={() => setEditando(x)}
            onDelete={() => setBorrando(x)}
          />
        ))}
      </div>
      {editando && (
        <ItemSimpleModal
          titulo={editando.id ? 'Editar extra' : 'Nuevo extra'}
          item={editando}
          precioField="precio"
          precioLabel="Precio (MXN)"
          onGuardar={guardarExtra}
          onClose={() => setEditando(null)}
        />
      )}
      {borrando && (
        <ConfirmModal titulo={`¿Borrar ${borrando.nombre}?`} confirmarLabel="Borrar" danger
          onConfirm={async () => { const x = borrando; setBorrando(null); await borrarExtra(x.id) }}
          onClose={() => setBorrando(null)} />
      )}
    </>
  )
}

function FilaSimple({ nombre, sub, inactivo, onEdit, onDelete }) {
  return (
    <div style={{ background: '#fff', border: '2.5px solid var(--jb-line)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, opacity: inactivo ? 0.5 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--jb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--jb-gray)' }}>{sub}</div>}
      </div>
      <div className="flex items-center" style={{ gap: 8, flexShrink: 0 }}>
        <button onClick={onEdit} title="Editar" style={{ ...quitarBtn, color: 'var(--jb-pink-dark)', background: 'var(--jb-pink-light)' }}>✎</button>
        <button onClick={onDelete} title="Borrar" style={quitarBtn}>✕</button>
      </div>
    </div>
  )
}

// Modal para catálogos simples (ingredientes, modificadores, extras). Si se pasa
// `precioField` ('extra' o 'precio') muestra un campo numérico ligado a ese campo.
function ItemSimpleModal({ titulo, item, precioField, precioLabel, onGuardar, onClose }) {
  const [nombre, setNombre] = useState(item.nombre ?? '')
  const [precio, setPrecio] = useState(precioField ? (item[precioField] ?? 0) : 0)
  const [activo, setActivo] = useState(item.activo !== false)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setGuardando(true)
    const payload = { id: item.id, nombre: nombre.trim(), activo }
    if (precioField) payload[precioField] = Number(precio) || 0
    const { error: err } = await onGuardar(payload)
    setGuardando(false)
    if (err) { setError(err); return }
    onClose()
  }

  return (
    <ModalShell width={440} titulo={titulo} onClose={onClose}>
      <Campo label="Nombre">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} autoFocus />
      </Campo>
      {precioField && (
        <Campo label={precioLabel}>
          <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" style={inputStyle} placeholder="0" />
        </Campo>
      )}
      <Toggle checked={activo} onChange={setActivo} label="Activo" />
      {error && <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#C24A4A' }}>{error}</p>}
      <div className="flex" style={{ gap: 12, marginTop: 6 }}>
        <Button variant="secondary" size="md" style={{ flex: 1 }} onClick={onClose}>Cancelar</Button>
        <Button size="md" style={{ flex: 1 }} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </ModalShell>
  )
}

const quitarBtn = {
  border: 'none', borderRadius: 10, width: 46, height: 46, flexShrink: 0,
  fontSize: 15, fontWeight: 800, cursor: 'pointer',
  background: '#F6E7E7', color: '#C24A4A',
}

const agregarBtn = {
  border: '2.5px dashed var(--jb-line)', borderRadius: 12, padding: '14px 0', minHeight: 48,
  fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 800,
  color: 'var(--jb-pink-dark)', background: '#fff', cursor: 'pointer',
}

// Botón "Borrar platillo" al pie del modal de edición, separado de Cancelar/Guardar
// y lejos de la ✕ de cerrar. Sombreado de rojo.
const borrarBtn = {
  width: '100%', border: '2px solid #E6C2C2', borderRadius: 14, padding: '12px 0', minHeight: 48,
  marginTop: 4, fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 800,
  cursor: 'pointer', background: '#F6E7E7', color: '#C24A4A',
}

// Encabezado de columna en el editor de niveles de precio.
const colHead = {
  fontSize: 11, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
  color: 'var(--jb-gray)',
}

// Valor de solo lectura (vista "Ver").
const valorLeer = {
  border: '2px solid var(--jb-line)', borderRadius: 12, padding: '11px 14px',
  fontSize: 15, color: 'var(--jb-ink)', background: 'var(--jb-cream)', whiteSpace: 'pre-wrap',
}
