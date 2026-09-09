import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMesas } from '../../hooks/useMesas'
import { useMesaAdmin } from '../../hooks/useMesaAdmin'
import { f, esParaLlevar } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { CrearMesaModal } from '../../components/mesero/CrearMesaModal'
import { RenombrarMesaModal } from '../../components/mesero/RenombrarMesaModal'

const ESTADO = {
  abierta: { texto: 'Cuenta abierta', color: 'var(--jb-pink)' },
  preparando: { texto: 'Armando pedido', color: 'var(--jb-warn)' },
  pagada: { texto: 'Pagada', color: 'var(--jb-ok)' },
  libre: { texto: 'Libre', color: 'var(--jb-gray)' },
}

const DUR_ANIM = 300 // ms que dura el deslizamiento de las tarjetas al reordenar

// Flechas ▲▼ para reordenar el listado. El extremo que no aplica queda inerte.
function MoverBtns({ onUp, onDown, disableUp, disableDown }) {
  const btn = (dis) => ({
    border: '2px solid var(--jb-line)', borderRadius: 9, width: 40, height: 40, flexShrink: 0,
    fontSize: 15, fontWeight: 900, cursor: dis ? 'default' : 'pointer',
    background: '#fff', color: dis ? 'var(--jb-line)' : 'var(--jb-ink)', opacity: dis ? 0.5 : 1,
  })
  return (
    <div className="flex" style={{ gap: 6 }}>
      <button onClick={onUp} disabled={disableUp} title="Subir" style={btn(disableUp)}>▲</button>
      <button onClick={onDown} disabled={disableDown} title="Bajar" style={btn(disableDown)}>▼</button>
    </div>
  )
}

// Gestión de mesas (solo admin, dentro de Ajustes): alta, cambio de nombre —acepta
// letras y números, único— baja, y el ORDEN del listado (▲▼). Ese orden es compartido:
// todos los meseros ven las mesas en la misma secuencia.
export default function AdminMesasPage() {
  const { mesas, meseros } = useMesas({ ignorarFiltro: true })
  const { crearMesa, renombrarMesa, reordenarMesas, borrarMesa } = useMesaAdmin()

  const [creando, setCreando] = useState(false)
  const [renombrando, setRenombrando] = useState(null)
  const [borrando, setBorrando] = useState(null)

  // Las mesas "Para llevar" se crean y cierran solas desde el flujo de pedidos.
  const listaStore = mesas.filter((m) => !esParaLlevar(m.numero))
  const idsStore = listaStore.map((m) => m.id).join(',')

  // Orden optimista: cada clic en ▲▼ reacomoda esta copia local al instante (varios
  // clics seguidos se acumulan) y se manda al backend con un pequeño debounce. Se
  // suelta cuando el backend confirma el mismo orden, si cambia el juego de mesas,
  // o tras un tope de seguridad.
  const [ordenOpt, setOrdenOpt] = useState(null)
  const rpcTimer = useRef(null)

  // El override optimista sigue vigente solo si tiene exactamente las mismas mesas
  // que el store y su orden aún difiere (si ya convergió, o cambió el juego de
  // mesas, se descarta durante el render — patrón soportado por React).
  const idsStoreSet = new Set(idsStore.split(',').filter(Boolean))
  const optVigente = !!ordenOpt
    && ordenOpt.length === idsStoreSet.size
    && ordenOpt.every((id) => idsStoreSet.has(id))
    && ordenOpt.join(',') !== idsStore
  if (ordenOpt && !optVigente) setOrdenOpt(null)

  const lista = optVigente ? ordenOpt.map((id) => listaStore.find((m) => m.id === id)) : listaStore
  const ordenActual = lista.map((m) => m.id).join(',')

  // Tope de seguridad: si el backend nunca confirma, se vuelve al orden real.
  useEffect(() => {
    if (!ordenOpt) return
    const t = setTimeout(() => setOrdenOpt(null), 4000)
    return () => clearTimeout(t)
  }, [ordenOpt])

  useEffect(() => () => clearTimeout(rpcTimer.current), [])

  // ── Animación FLIP: cuando cambia el orden, cada tarjeta se desliza físicamente
  // desde donde estaba hasta su nuevo lugar, en vez de saltar.
  const nodos = useRef(new Map())
  const rectsPrev = useRef(new Map())

  useLayoutEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const rectsNuevos = new Map()
    nodos.current.forEach((el, id) => rectsNuevos.set(id, el.getBoundingClientRect()))

    if (!reduce) {
      let huboMovimiento = false
      nodos.current.forEach((el, id) => {
        const viejo = rectsPrev.current.get(id)
        const nuevo = rectsNuevos.get(id)
        if (!viejo || !nuevo) return
        const dx = viejo.left - nuevo.left
        const dy = viejo.top - nuevo.top
        if (!dx && !dy) return
        huboMovimiento = true
        el.style.transition = 'none'
        el.style.transform = `translate(${dx}px, ${dy}px)`
      })
      if (huboMovimiento) {
        void document.body.offsetWidth // reflow para fijar la posición invertida
        requestAnimationFrame(() => {
          nodos.current.forEach((el) => {
            if (el.style.transform) {
              el.style.transition = `transform ${DUR_ANIM}ms cubic-bezier(0.22, 1, 0.36, 1)`
              el.style.transform = ''
            }
          })
        })
      }
    }
    rectsPrev.current = rectsNuevos
  }, [ordenActual])

  function moverMesa(idx, dir) {
    const destino = idx + dir
    if (destino < 0 || destino >= lista.length) return
    const nuevo = lista.map((m) => m.id)
    ;[nuevo[idx], nuevo[destino]] = [nuevo[destino], nuevo[idx]]
    setOrdenOpt(nuevo)
    const idsPL = mesas.filter((m) => esParaLlevar(m.numero)).map((m) => m.id)
    clearTimeout(rpcTimer.current)
    rpcTimer.current = setTimeout(() => reordenarMesas([...nuevo, ...idsPL]), 250)
  }

  async function confirmarBorrado() {
    const m = borrando
    setBorrando(null)
    const { error } = await borrarMesa(m.id)
    if (error) window.alert(error)
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px 60px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: 'var(--jb-ink)' }}>Mesas</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--jb-ink-soft)' }}>
            {lista.length} {lista.length === 1 ? 'mesa' : 'mesas'} · usa ▲▼ para el orden que ven todos los meseros
          </p>
        </div>
        <Button size="md" onClick={() => setCreando(true)}>+ Nueva mesa</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {lista.map((m, idx) => {
          const est = ESTADO[m.estado] ?? ESTADO.libre
          const ocupada = m.estado === 'abierta'
          return (
            <div
              key={m.id}
              ref={(el) => {
                if (el) nodos.current.set(m.id, el)
                else nodos.current.delete(m.id)
              }}
              style={{
                background: '#fff', border: '3px solid var(--jb-line)', borderRadius: 20,
                padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
                willChange: 'transform',
              }}
            >
              <div className="flex items-center justify-between" style={{ gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--jb-ink)' }}>{m.numero}</span>
                <MoverBtns
                  onUp={() => moverMesa(idx, -1)}
                  onDown={() => moverMesa(idx, 1)}
                  disableUp={idx === 0}
                  disableDown={idx === lista.length - 1}
                />
              </div>
              <div className="flex items-center justify-between" style={{ gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--jb-ink-soft)' }}>
                  {ocupada ? `Total en curso: ${f(m.total)}` : 'Sin cuenta'}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: '#fff', background: est.color,
                  padding: '3px 9px', borderRadius: 999, letterSpacing: 0.3, whiteSpace: 'nowrap',
                }}>
                  {est.texto}
                </span>
              </div>
              <div className="flex" style={{ gap: 8, marginTop: 4 }}>
                <Button variant="secondary" size="md" style={{ flex: 1 }} onClick={() => setRenombrando(m)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  disabled={ocupada}
                  title={ocupada ? 'No se puede borrar una mesa con cuenta abierta' : undefined}
                  style={{ color: ocupada ? 'var(--jb-gray)' : '#C24A4A' }}
                  onClick={() => setBorrando(m)}
                >
                  Borrar
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {creando && (
        <CrearMesaModal meseros={meseros} onConfirm={crearMesa} onClose={() => setCreando(false)} />
      )}

      {renombrando && (
        <RenombrarMesaModal
          mesa={renombrando}
          onConfirm={(nombre) => renombrarMesa(renombrando.id, nombre)}
          onClose={() => setRenombrando(null)}
        />
      )}

      {borrando && (
        <ConfirmModal
          titulo={`¿Borrar la mesa ${borrando.numero}?`}
          mensaje="Deja de aparecer en el mapa. Los pedidos y cuentas que ya la referencian conservan su historial."
          confirmarLabel="Borrar mesa"
          danger
          onConfirm={confirmarBorrado}
          onClose={() => setBorrando(null)}
        />
      )}
    </div>
  )
}
