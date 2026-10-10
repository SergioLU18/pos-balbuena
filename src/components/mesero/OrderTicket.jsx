import { useState } from 'react'
import { f } from '../../lib/utils'
import { describirMitades, extrasTexto } from '../../lib/describirItem'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { AutorizarAdminModal } from '../layout/AutorizarAdminModal'
import { calcItemPrecio } from '../../hooks/useOrderDraft'
import { useVertical } from '../../hooks/useVertical'
import { claveRenglonPorNombre } from '../../lib/renglones'
import { EMPAQUES, empaqueTexto } from '../../lib/empaque'

function DescripcionItem({ item }) {
  const extras = extrasTexto(item)
  return (
    <>
      {describirMitades(item).map(({ lado, prefijo, texto }) => (
        <p key={lado} style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--jb-ink-soft)' }}>
          {prefijo}{texto}
        </p>
      ))}
      {extras && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--jb-ink-soft)' }}>{extras}</p>}
    </>
  )
}

// Etiqueta de solo lectura para un renglón cuyo pedido ya no está en Nuevo. El piso
// (MesaCard.jsx) ya no distingue estas sub-etapas de cocina — solo "Cuenta abierta" o
// "Pagada" — pero aquí, DENTRO de la orden de una mesa, sigue sirviendo para saber qué
// platillo en concreto ya está listo para recoger.
const ESTADO_LABEL = {
  // 'pendiente' = ya enviado a cocina pero todavía en la columna "Nuevo" (cocina no lo
  // empezó): sigue editable, pero necesita su propia etiqueta para no confundirse con un
  // renglón del draft que aún no se ha mandado.
  pendiente: { texto: 'Enviado a cocina ✓', color: 'var(--jb-ok)' },
  preparando: { texto: 'En preparación', color: '#2C5F86' },
  listo: { texto: '¡Listo para servir!', color: '#1B5E66' },
  entregado: { texto: 'Entregado', color: 'var(--jb-gray)' },
}

// Desechable / tupper de un renglón de una orden para llevar. Sin `onChange` (un
// platillo de mesa marcado para llevar en el modal, que ya no se cambia) solo se lee.
function EmpaqueToggle({ item, onChange }) {
  if (!onChange) {
    const texto = empaqueTexto(item)
    return texto ? <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--jb-teal)' }}>{texto}</p> : null
  }
  if (!item.empaque) return null
  return (
    <div role="group" aria-label="Empaque" className="flex" style={{ marginTop: 8, gap: 6 }}>
      {Object.entries(EMPAQUES).map(([id, { texto, ajuste }]) => {
        const activo = item.empaque === id
        return (
          <button
            key={id}
            aria-pressed={activo}
            onClick={() => { if (!activo) onChange(id) }}
            style={{
              flex: 1, padding: '6px 8px', borderRadius: 10, cursor: activo ? 'default' : 'pointer',
              fontFamily: "'Inter Tight', sans-serif", fontSize: 12, fontWeight: 800,
              border: `2px solid ${activo ? 'var(--jb-teal)' : 'var(--jb-line)'}`,
              background: activo ? 'var(--jb-teal)' : '#fff', color: activo ? '#fff' : 'var(--jb-ink-soft)',
            }}
          >
            {texto} {ajuste < 0 ? '−' : '+'}{f(Math.abs(ajuste))}
          </button>
        )
      })}
    </div>
  )
}

function CantidadControles({ cantidad, onDec, onInc, onEdit, onRemove, decDeshabilitado = false, quitarLabel = 'Quitar' }) {
  return (
    <div className="flex items-center justify-between" style={{ marginTop: 8, gap: 8 }}>
      <div className="flex items-center" style={{ gap: 0, border: '2px solid var(--jb-line)', borderRadius: 10, overflow: 'hidden' }}>
        <button
          onClick={onDec}
          disabled={decDeshabilitado}
          aria-label="Menos"
          style={{ width: 34, height: 34, border: 'none', background: 'var(--jb-cream)', fontSize: 16, fontWeight: 800, cursor: decDeshabilitado ? 'default' : 'pointer', opacity: decDeshabilitado ? 0.35 : 1 }}
        >
          −
        </button>
        <span style={{ width: 30, textAlign: 'center', fontSize: 14, fontWeight: 800 }}>{cantidad}</span>
        <button onClick={onInc} style={{ width: 34, height: 34, border: 'none', background: 'var(--jb-cream)', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>+</button>
      </div>
      <div className="flex items-center" style={{ gap: 14 }}>
        {onEdit && (
          <button onClick={onEdit} style={{ background: 'none', border: 'none', color: 'var(--jb-pink-dark)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            Editar
          </button>
        )}
        <BotonQuitar onClick={onRemove}>{quitarLabel}</BotonQuitar>
      </div>
    </div>
  )
}

function BotonQuitar({ onClick, children }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', color: '#C24A4A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
      {children}
    </button>
  )
}

// Qué tan avanzado va lo que se va a cancelar, para que el admin sepa qué autoriza.
const AVISO_CANCELAR = {
  pendiente: 'Ya está enviado a cocina, así que también desaparecerá de su tablero.',
  preparando: 'Cocina ya lo está preparando.',
  listo: 'Cocina ya lo tiene listo.',
  entregado: 'Ya se entregó.',
}

// Cancelar comida ya enviada: primero cuántas piezas (si el renglón trae más de una),
// después la autorización de un admin. Ningún mesero cancela solo, ni siquiera lo que
// cocina aún no empieza (ver pos_admin_autoriza).
function CancelarEnviadoModal({ nombre, maximo, estado, onConfirm, onClose }) {
  const [cantidad, setCantidad] = useState(maximo)
  const [autorizando, setAutorizando] = useState(false)

  if (autorizando) {
    return (
      <AutorizarAdminModal
        titulo={`Cancelar ${cantidad}× ${nombre}`}
        onAutorizado={(admin) => onConfirm(cantidad, admin)}
        onClose={onClose}
      />
    )
  }

  return (
    <ConfirmModal
      titulo="¿Cancelar platillo?"
      mensaje={`"${nombre}". ${AVISO_CANCELAR[estado] ?? ''} Se descuenta de la cuenta y lo tiene que autorizar un administrador.`}
      confirmarLabel="Pedir autorización"
      cancelarLabel="Conservar"
      danger
      onConfirm={() => setAutorizando(true)}
      onClose={onClose}
    >
      {maximo > 1 && (
        <div className="flex items-center justify-between" style={{ gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--jb-ink)' }}>¿Cuántos cancelar? (de {maximo})</span>
          <CantidadControlesSimple
            cantidad={cantidad}
            onDec={() => setCantidad((c) => Math.max(1, c - 1))}
            onInc={() => setCantidad((c) => Math.min(maximo, c + 1))}
          />
        </div>
      )}
    </ConfirmModal>
  )
}

function CantidadControlesSimple({ cantidad, onDec, onInc }) {
  const boton = { width: 40, height: 40, border: 'none', background: 'var(--jb-cream)', fontSize: 18, fontWeight: 800, cursor: 'pointer' }
  return (
    <div className="flex items-center" style={{ border: '2px solid var(--jb-line)', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
      <button onClick={onDec} aria-label="Cancelar menos" style={boton}>−</button>
      <span style={{ width: 34, textAlign: 'center', fontSize: 16, fontWeight: 800 }}>{cantidad}</span>
      <button onClick={onInc} aria-label="Cancelar más" style={boton}>+</button>
    </div>
  )
}

function DraftRow({ item, onQty, onEdit, onRemove, onEmpaque }) {
  const precio = calcItemPrecio(item)
  return (
    <div className="jb-fade-up" style={{ padding: '12px 0', borderBottom: '1.5px solid var(--jb-line)' }}>
      <div className="flex items-start justify-between" style={{ gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--jb-ink)' }}>
            {item.cantidad > 1 ? `${item.cantidad}× ` : ''}{item.platilloNombre} · {item.tier.nombre}
          </span>
          <DescripcionItem item={item} />
          {item.nota && <p style={{ margin: '2px 0 0', fontSize: 12, fontStyle: 'italic', color: 'var(--jb-pink-dark)' }}>“{item.nota}”</p>}
          {item.modificaOriginal && (
            <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--jb-pink-dark)' }}>
              Cambio sin enviar (antes {item.modificaOriginal})
            </p>
          )}
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--jb-ink)', flexShrink: 0 }}>{f(precio * item.cantidad)}</span>
      </div>
      <EmpaqueToggle item={item} onChange={onEmpaque ? (e) => onEmpaque(item.id, e) : undefined} />
      <CantidadControles
        cantidad={item.cantidad}
        onDec={() => onQty(item.id, -1)}
        onInc={() => onQty(item.id, 1)}
        onEdit={onEdit ? () => onEdit(item) : undefined}
        onRemove={() => onRemove(item.id)}
      />
    </div>
  )
}

function EnviadoRow({ item, pedido, pedidoItemId, staged, puedeEditarPlatillo, onStage, onRevert, onEdit, onCancelar, onEmpaque }) {
  // Un renglón ya enviado puede venir "rico" (el de una comanda para llevar: tier +
  // mitades) o "plano" (cuenta_items de tali: nombre + precio_unitario). Se soportan ambos.
  const esRico = item.tier != null && item.mitades != null
  const precio = esRico ? calcItemPrecio(item) : Number(item.precio_unitario)
  const nombre = esRico ? `${item.platilloNombre} · ${item.tier.nombre}` : item.nombre
  // Editable mientras su comanda siga en Nuevo. Si no se encuentra el pedido de origen
  // (caso legado, o cuenta_items sin pedido asociado), se trata como no editable.
  const editable = pedido?.estado === 'pendiente'
  // El renglón "rico" completo vive en pedidos.items (no en cuenta_items). Solo se puede
  // reeditar si ese renglón existe y su platillo sigue en el menú.
  const itemRico = pedido?.items?.find((it) => it.id === pedidoItemId)
  const puedeEditar = editable && itemRico?.tier != null && !!puedeEditarPlatillo?.(itemRico.platilloId)
  const estadoLabel = pedido ? ESTADO_LABEL[pedido.estado] : null
  // Cancelar (todo o parte) se puede en cualquier columna de cocina mientras exista su
  // comanda — al cobrar la cuenta las comandas se borran —, siempre con un admin.
  const [cancelando, setCancelando] = useState(false)
  // "Editar" un renglón enviado lo retira de la comanda y lo regresa al draft, o sea que
  // también cancela lo que cocina ya tenía: pide la misma autorización antes de abrirse.
  const [autorizandoEdicion, setAutorizandoEdicion] = useState(false)

  // Los −/+ NO mandan nada a cocina: solo ajustan una cantidad en preview (`staged`) que
  // se confirma al pulsar "Enviar a cocina". Mientras `staged` difiera de lo ya enviado,
  // el renglón muestra un aviso de "cambio sin enviar" y un botón para descartarlo.
  // El − no baja de lo ya enviado: menos que eso es cancelar, y va por "Cancelar".
  const enviada = item.cantidad
  const cantidad = editable && staged != null ? staged : enviada
  const editado = editable && staged != null && staged !== enviada

  function confirmarCancelar(piezas, admin) {
    onCancelar(pedido.id, pedidoItemId, piezas, admin.id)
    setCancelando(false)
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1.5px solid var(--jb-line)', opacity: editable ? 1 : 0.75 }}>
      <div className="flex items-start justify-between" style={{ gap: 10 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--jb-ink)' }}>
            {cantidad > 1 ? `${cantidad}× ` : ''}{nombre}
          </span>
          {esRico && <DescripcionItem item={item} />}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{f(precio * cantidad)}</span>
      </div>
      <span style={{ display: 'block', marginTop: 4, fontSize: 11, fontWeight: 700, color: editado ? 'var(--jb-pink-dark)' : (estadoLabel?.color ?? 'var(--jb-ok)') }}>
        {editado ? `Cambio sin enviar (antes ${enviada})` : (estadoLabel?.texto ?? 'Enviado a cocina ✓')}
      </span>
      {/* El empaque sí se puede cambiar aunque cocina ya haya tomado la comanda: no cambia
          qué se cocina, solo cuánto se cobra (ver cambiarEmpaqueEnviado). */}
      <EmpaqueToggle
        item={item}
        onChange={onEmpaque && pedido ? (e) => onEmpaque(pedido.id, pedidoItemId, e) : undefined}
      />
      {editable ? (
        <CantidadControles
          cantidad={cantidad}
          decDeshabilitado={cantidad <= enviada}
          onDec={() => onStage(pedidoItemId, Math.max(enviada, cantidad - 1))}
          onInc={() => onStage(pedidoItemId, cantidad + 1)}
          onEdit={puedeEditar ? () => setAutorizandoEdicion(true) : undefined}
          onRemove={() => setCancelando(true)}
          quitarLabel="Cancelar"
        />
      ) : pedido && itemRico && (
        <div className="flex justify-end" style={{ marginTop: 6 }}>
          <BotonQuitar onClick={() => setCancelando(true)}>Cancelar</BotonQuitar>
        </div>
      )}
      {editado && (
        <button
          onClick={() => onRevert(pedidoItemId)}
          style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, color: 'var(--jb-ink-soft)', fontSize: 12, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
        >
          Deshacer cambio
        </button>
      )}

      {cancelando && (
        <CancelarEnviadoModal
          nombre={nombre}
          // Las piezas de ESTA comanda: la fila de la cuenta puede juntar varias comandas
          // del mismo platillo, pero se cancela sobre el renglón de una.
          maximo={itemRico?.cantidad ?? enviada}
          estado={pedido.estado}
          onConfirm={confirmarCancelar}
          onClose={() => setCancelando(false)}
        />
      )}

      {autorizandoEdicion && (
        <AutorizarAdminModal
          titulo={`Editar ${nombre}`}
          onAutorizado={(admin) => { setAutorizandoEdicion(false); onEdit(pedido, pedidoItemId, itemRico, admin.id) }}
          onClose={() => setAutorizandoEdicion(false)}
        />
      )}
    </div>
  )
}

// `clave` decide con qué se casa un renglón mostrado contra el renglón de la comanda que
// lo originó — de eso dependen los −/+, el "Editar" y el "Quitar" de un renglón ya
// enviado. El default es el de las cuentas de mesa; la orden para llevar pasa el suyo
// (ver src/lib/renglones.js).
export function OrderTicket({ draft, cuenta, pedidos, subtotalDraft, subtotalCuenta, puedeEditarPlatillo, onQty, onRemove, onEditarDraft, onEditarEnviado, onFijarEnviado, onCancelarEnviado, onEmpaque, onEmpaqueEnviado, onEnviar, enviando = false, clave = claveRenglonPorNombre, titulo = 'Comanda' }) {
  const vertical = useVertical()

  // Mapa clave -> { pedido de origen, id del renglón DENTRO de ese pedido }, para saber
  // si un renglón ya enviado sigue editable (su pedido en 'pendiente'/Nuevo) o ya lo tomó
  // cocina, y para pasarle a la RPC el item id del pedido (no el de cuenta_items). Se
  // prefiere un pedido en 'pendiente' cuando el mismo nombre aparece en varias comandas.
  const origenPorClave = new Map()
  for (const p of pedidos ?? []) {
    for (const it of p.items) {
      const k = clave(it)
      const prev = origenPorClave.get(k)
      if (!prev || (p.estado === 'pendiente' && prev.pedido.estado !== 'pendiente')) {
        origenPorClave.set(k, { pedido: p, itemId: it.id, cantidad: it.cantidad })
      }
    }
  }

  // Ajustes de cantidad en preview sobre renglones ya enviados, por id de renglón del
  // pedido. No tocan cocina hasta pulsar "Enviar a cocina" (que los confirma en bloque).
  const [edits, setEdits] = useState({})
  const stageQty = (pedidoItemId, next) => setEdits((e) => ({ ...e, [pedidoItemId]: Math.max(1, next) }))
  const revertQty = (pedidoItemId) => setEdits((e) => { const { [pedidoItemId]: _omit, ...rest } = e; return rest })
  // Al cancelar un renglón se descarta también cualquier ajuste pendiente suyo.
  const cancelarEnviado = (pedidoId, pedidoItemId, piezas, autorizaId) => { revertQty(pedidoItemId); onCancelarEnviado(pedidoId, pedidoItemId, piezas, autorizaId) }

  // Ajustes pendientes reales (staged distinto de lo enviado) + su efecto en el total,
  // para habilitar el botón y mostrar el total ya con los cambios reflejados.
  const editsPendientes = []
  let editDelta = 0
  for (const item of cuenta?.items ?? []) {
    const origen = origenPorClave.get(clave(item))
    if (!origen) continue
    const staged = edits[origen.itemId]
    if (staged == null || staged === item.cantidad) continue
    // `staged` es sobre la fila de la cuenta, que junta las piezas de TODAS las comandas
    // con ese platillo; la RPC fija la cantidad del renglón de UNA comanda. Por eso se
    // manda lo que ese renglón ya tenía más lo que se sumó, no `staged` tal cual (con
    // 2 en una comanda y 1 en otra, un + fijaba la segunda en 4 y sumaba 3 piezas).
    editsPendientes.push({ pedidoId: origen.pedido.id, itemId: origen.itemId, cantidad: origen.cantidad + (staged - item.cantidad) })
    const precio = item.precio_unitario != null ? Number(item.precio_unitario) : calcItemPrecio(item)
    editDelta += precio * (staged - item.cantidad)
  }

  const hayEdits = editsPendientes.length > 0
  const totalGeneral = subtotalDraft + subtotalCuenta + editDelta
  const puedeEnviar = draft.length > 0 || hayEdits

  function enviarTodo() {
    if (enviando) return
    editsPendientes.forEach((e) => onFijarEnviado(e.pedidoId, e.itemId, e.cantidad))
    if (draft.length > 0) onEnviar()
    setEdits({})
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: '#fff', borderRadius: 24, border: '2.5px solid var(--jb-line)', overflow: 'hidden' }}
    >
      <div style={{ padding: '18px 22px', borderBottom: '2px solid var(--jb-line)' }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--jb-ink)' }}>{titulo}</h3>
      </div>

      <div className="flex-1 no-scrollbar" style={{ overflowY: 'auto', padding: '4px 22px' }}>
        {cuenta?.items?.length > 0 && cuenta.items.map((item) => {
          const origen = origenPorClave.get(clave(item))
          return (
            <EnviadoRow
              key={item.id}
              item={item}
              pedido={origen?.pedido}
              pedidoItemId={origen?.itemId}
              staged={origen ? edits[origen.itemId] : undefined}
              puedeEditarPlatillo={puedeEditarPlatillo}
              onStage={stageQty}
              onRevert={revertQty}
              onEdit={onEditarEnviado}
              onCancelar={cancelarEnviado}
              onEmpaque={onEmpaqueEnviado}
            />
          )
        })}

        {draft.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--jb-gray)', fontSize: 14, padding: '32px 0' }}>
            Toca un platillo para agregarlo a la orden.
          </p>
        ) : (
          draft.map((item) => (
            <DraftRow
              key={item.id}
              item={item}
              onQty={onQty}
              onEdit={puedeEditarPlatillo?.(item.platilloId) ? onEditarDraft : undefined}
              onRemove={onRemove}
              onEmpaque={onEmpaque}
            />
          ))
        )}
      </div>

      {/* En vertical el ticket va debajo del menú con menos alto: total y botón se ponen
          lado a lado para dejarle más espacio a los renglones. */}
      <div
        style={{
          padding: vertical ? '14px 22px' : '18px 22px', borderTop: '2px solid var(--jb-line)',
          display: 'flex', flexDirection: vertical ? 'row' : 'column',
          alignItems: vertical ? 'center' : 'stretch', gap: vertical ? 20 : 14,
        }}
      >
        <div
          className="flex justify-between"
          style={vertical ? { flexDirection: 'column', flexShrink: 0 } : { alignItems: 'center' }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--jb-ink-soft)' }}>Total</span>
          <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>{f(totalGeneral)}</span>
        </div>
        <Button
          onClick={enviarTodo}
          disabled={!puedeEnviar || enviando}
          className={puedeEnviar && !enviando ? 'jb-cta-pulse' : undefined}
          style={vertical ? { flex: 1 } : { width: '100%' }}
        >
          {enviando ? 'Enviando…' : draft.length > 0
            ? `Enviar ${draft.length} platillo${draft.length > 1 ? 's' : ''}${hayEdits ? ' y cambios' : ''} a cocina`
            : hayEdits ? 'Enviar cambios a cocina' : 'Enviar a cocina'}
        </Button>
      </div>
    </div>
  )
}
