import { useState } from 'react'
import { usePosStore, useMeseroStore } from '../../store/appStore'
import { atiende, mesasDeMesero, meserosDeMesa } from '../../lib/asignaciones'
import { useMeseroAdmin } from '../../hooks/useMeseroAdmin'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { ModalShell, Campo, Toggle } from '../../components/admin/AdminModal'
import { inputStyle } from '../../components/admin/adminStyles'
import { PinPad } from '../../components/layout/PinPad'

const porNumero = (a, b) => Number(a.numero) - Number(b.numero)

/** El reparto de un mesero: las mesas que atiende, y de esas, cuáles comparte y con
 *  quién. Una mesa puede tener varios meseros, así que "sus" mesas no son exclusivas
 *  y conviene que el admin vea el traslape antes de mover nada. */
function repartoDeMesero(meseroId, mesas, meseros, asignaciones) {
  const suyas = mesas.filter((m) => atiende(asignaciones, m.id, meseroId)).sort(porNumero)
  const compartidas = suyas
    .map((m) => ({
      numero: m.numero,
      con: meserosDeMesa(asignaciones, m.id)
        .filter((id) => id !== meseroId)
        .map((id) => meseros.find((w) => w.id === id)?.nombre)
        .filter(Boolean),
    }))
    .filter((x) => x.con.length > 0)
  return { suyas, compartidas }
}

// Gestión de meseros: alta, edición (nombre, PIN, mesas que atiende, rol admin,
// activo) y baja. Guardas para no quedarse sin admin: no puedes borrarte a ti
// mismo, ni dejar al restaurante sin ningún mesero administrador.
export default function AdminMeserosPage() {
  const meseros = usePosStore((s) => s.meseros)
  const mesas = usePosStore((s) => s.mesas)
  const asignaciones = usePosStore((s) => s.asignaciones)
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const { guardarMesero, borrarMesero } = useMeseroAdmin()

  const [editando, setEditando] = useState(null) // mesero en edición, o {} para nuevo
  const [borrando, setBorrando] = useState(null) // mesero a confirmar borrado

  const mesasOrdenadas = [...mesas].sort(porNumero)
  const adminsActivos = meseros.filter((m) => m.esAdmin && m.activo !== false)
  const esUltimoAdmin = (m) => m.esAdmin && adminsActivos.length <= 1
  // Mesas que atiende más de un mesero. Se muestra arriba porque es lo que distingue
  // este reparto del de antes, cuando una mesa era de un solo mesero.
  const compartidas = mesas.filter((m) => meserosDeMesa(asignaciones, m.id).length > 1).length

  async function confirmarBorrado() {
    const m = borrando
    setBorrando(null)
    await borrarMesero(m.id)
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px 60px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: 'var(--jb-ink)' }}>Meseros</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--jb-ink-soft)' }}>
            {meseros.length} {meseros.length === 1 ? 'mesero' : 'meseros'} · {adminsActivos.length} admin
            {compartidas > 0 && ` · ${compartidas} ${compartidas === 1 ? 'mesa compartida' : 'mesas compartidas'}`}
          </p>
        </div>
        <Button size="md" onClick={() => setEditando({})}>+ Nuevo mesero</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {meseros.map((m) => (
          <MeseroCard
            key={m.id}
            mesero={m}
            reparto={repartoDeMesero(m.id, mesas, meseros, asignaciones)}
            esActual={m.id === currentMeseroId}
            onEdit={() => setEditando(m)}
            onDelete={() => setBorrando(m)}
          />
        ))}
      </div>

      {editando && (
        <MeseroModal
          mesero={editando}
          mesas={mesasOrdenadas}
          asignaciones={asignaciones}
          esUltimoAdmin={editando.id ? esUltimoAdmin(editando) : false}
          onGuardar={guardarMesero}
          onClose={() => setEditando(null)}
        />
      )}

      {borrando && (
        <ConfirmModal
          titulo={`¿Borrar a ${borrando.nombre}?`}
          mensaje="Dejará de aparecer en el POS. Los pedidos que ya envió conservan su nombre."
          confirmarLabel="Borrar mesero"
          danger
          onConfirm={confirmarBorrado}
          onClose={() => setBorrando(null)}
        />
      )}
    </div>
  )
}

function MeseroCard({ mesero, reparto, esActual, onEdit, onDelete }) {
  const inactivo = mesero.activo === false
  return (
    <div
      style={{
        background: '#fff', border: '3px solid var(--jb-line)', borderRadius: 20,
        padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10, opacity: inactivo ? 0.55 : 1,
      }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--jb-ink)' }}>{mesero.nombre}</span>
        <div className="flex items-center" style={{ gap: 6 }}>
          {mesero.esAdmin && <Badge color="var(--jb-pink)">Admin</Badge>}
          {inactivo && <Badge color="var(--jb-gray)">Inactivo</Badge>}
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--jb-ink-soft)' }}>
        {reparto.suyas.length
          ? `Mesas: ${reparto.suyas.map((m) => m.numero).join(', ')}`
          : 'Sin mesas asignadas'}
      </div>
      {reparto.compartidas.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--jb-gray)' }}>
          Comparte {reparto.compartidas.map((c) => `${c.numero} (${c.con.join(', ')})`).join(' · ')}
        </div>
      )}
      <div style={{ fontSize: 13, color: 'var(--jb-gray)' }}>
        PIN: {mesero.pin ? '••••' : 'sin PIN'}
      </div>
      <div className="flex" style={{ gap: 8, marginTop: 4 }}>
        <Button variant="secondary" size="md" style={{ flex: 1 }} onClick={onEdit}>Editar</Button>
        <Button
          variant="ghost" size="md"
          disabled={esActual}
          title={esActual ? 'No puedes borrarte a ti mismo' : undefined}
          style={{ color: esActual ? 'var(--jb-gray)' : '#C24A4A' }}
          onClick={onDelete}
        >
          Borrar
        </Button>
      </div>
    </div>
  )
}

function Badge({ color, children }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, color: '#fff', background: color,
      padding: '3px 9px', borderRadius: 999, letterSpacing: 0.3,
    }}>
      {children}
    </span>
  )
}

function MeseroModal({ mesero, mesas, asignaciones, esUltimoAdmin, onGuardar, onClose }) {
  const esNuevo = !mesero.id
  const [nombre, setNombre] = useState(mesero.nombre ?? '')
  const [pin, setPin] = useState(mesero.pin ?? '')
  // Ids de mesa, no números: el número es editable y reciclable (ver asignaciones.js).
  const [mesasSel, setMesasSel] = useState(() => mesasDeMesero(asignaciones, mesero.id))
  const [esAdmin, setEsAdmin] = useState(!!mesero.esAdmin)
  const [activo, setActivo] = useState(mesero.activo !== false)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Volver admin a alguien es delicado, así que no basta con destildar el toggle: hay
  // que confirmar y, si quien está en la sesión tiene PIN, volver a teclearlo (mismo
  // criterio de "atribución" que el gate de /admin en AdminEntry.jsx). Quitar el rol
  // sigue siendo inmediato — lo que se protege es DAR el poder, no retirarlo.
  const meserosStore = usePosStore((s) => s.meseros)
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const actor = meserosStore.find((w) => w.id === currentMeseroId)
  const [pidiendoAdmin, setPidiendoAdmin] = useState(false)
  const [pinIngresado, setPinIngresado] = useState('')
  const [pinError, setPinError] = useState(false)

  function onToggleAdmin(next) {
    if (!next) { setEsAdmin(false); return }
    setPinIngresado('')
    setPinError(false)
    setPidiendoAdmin(true)
  }

  function confirmarAdminSinPin() {
    setEsAdmin(true)
    setPidiendoAdmin(false)
  }

  function teclearPinAdmin(d) {
    if (pinIngresado.length >= 4) return
    const siguiente = pinIngresado + d
    setPinIngresado(siguiente)
    setPinError(false)
    if (siguiente.length === 4) {
      if (siguiente === actor?.pin) {
        setEsAdmin(true)
        setPidiendoAdmin(false)
      } else {
        setPinError(true)
        setPinIngresado('')
      }
    }
  }
  // "Seleccionar todas" deja el siguiente clic en UNA mesa en modo especial: en vez
  // de destildarla nada más, se queda solo esa (partir de cero, no de las 15 ya
  // marcadas). Un toggle normal después de eso vuelve a sumar/quitar como siempre.
  const [modoTodas, setModoTodas] = useState(false)

  function toggleMesa(mesaId) {
    if (modoTodas) {
      setMesasSel([mesaId])
      setModoTodas(false)
      return
    }
    setMesasSel((prev) => (prev.includes(mesaId) ? prev.filter((x) => x !== mesaId) : [...prev, mesaId]))
  }

  function seleccionarTodas() {
    setMesasSel(mesas.map((m) => m.id))
    setModoTodas(true)
  }

  async function guardar() {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (pin && !/^\d{4}$/.test(pin)) { setError('El PIN debe ser de 4 dígitos (o vacío).'); return }
    // No dejar al restaurante sin admin: si es el último admin, no se le puede
    // quitar el rol ni desactivar.
    if (esUltimoAdmin && (!esAdmin || !activo)) {
      setError('Es el único mesero admin. Asigna a otro como admin antes de quitarle el rol.')
      return
    }
    setGuardando(true)
    const { error: err } = await onGuardar({
      id: mesero.id, nombre: nombre.trim(), pin, mesas: mesasSel, esAdmin, activo,
    })
    setGuardando(false)
    if (err) { setError(err); return }
    onClose()
  }

  return (
    <ModalShell
      onClose={onClose}
      titulo={esNuevo ? 'Nuevo mesero' : `Editar ${mesero.nombre}`}
      footer={(
        <>
          {error && <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#C24A4A' }}>{error}</p>}
          <div className="flex" style={{ gap: 12 }}>
            <Button variant="secondary" size="md" style={{ flex: 1 }} onClick={onClose}>Cancelar</Button>
            <Button size="md" style={{ flex: 1 }} disabled={guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </>
      )}
    >
      <Campo label="Nombre">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          name="jb-mesero-nombre"
          autoComplete="off"
          style={inputStyle}
          placeholder="Ej. Doña Rosa"
        />
      </Campo>

      {/* type/name "raros" + autoComplete off: el AutoFill de iOS y los gestores de
          contraseñas bloqueaban el tecleo al creer que era un campo de contraseña. */}
      <Campo label="PIN (4 dígitos, opcional)">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          type="text"
          inputMode="numeric"
          maxLength={4}
          name="jb-mesero-pin"
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          style={{ ...inputStyle, letterSpacing: 4 }}
          placeholder="1234"
        />
      </Campo>

      <Campo label="Mesas que atiende">
        {mesas.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--jb-gray)' }}>No hay mesas creadas todavía.</span>
        ) : (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--jb-gray)' }}>
              Una mesa puede tener varios meseros: marcarla aquí no se la quita a nadie.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
              <Button
                variant="secondary"
                size="md"
                onClick={seleccionarTodas}
                style={{
                  gridColumn: '1 / -1',
                  ...(modoTodas ? { background: 'var(--jb-pink-tint)', border: '2px solid var(--jb-pink)' } : {}),
                }}
              >
                Seleccionar todas
              </Button>
              {mesas.map((m) => (
                <Chip key={m.id} active={mesasSel.includes(m.id)} onClick={() => toggleMesa(m.id)}>
                  {m.numero}
                </Chip>
              ))}
            </div>
          </>
        )}
      </Campo>

      <div className="flex" style={{ gap: 20, flexWrap: 'wrap' }}>
        <Toggle checked={esAdmin} onChange={onToggleAdmin} label="Administrador (edita meseros y menú)" />
        <Toggle checked={activo} onChange={setActivo} label="Activo" />
      </div>

      {pidiendoAdmin && (
        actor?.pin ? (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setPidiendoAdmin(false) }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20,
            }}
          >
            <div style={{
              background: '#fff', borderRadius: 26, width: 420, maxWidth: '100%',
              fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
              padding: '28px 28px 32px',
            }}>
              <PinPad
                titulo="Confirmar"
                subtitulo={`Ingresa tu PIN, ${actor.nombre}, para hacer administrador a ${nombre.trim() || mesero.nombre}`}
                entered={pinIngresado}
                error={pinError}
                onDigit={teclearPinAdmin}
                onBack={() => { setPinIngresado((p) => p.slice(0, -1)); setPinError(false) }}
                onCancel={() => setPidiendoAdmin(false)}
              />
            </div>
          </div>
        ) : (
          <ConfirmModal
            titulo="¿Hacer administrador?"
            mensaje={`${nombre.trim() || mesero.nombre} podrá editar meseros y el menú.`}
            confirmarLabel="Sí, hacer admin"
            onConfirm={confirmarAdminSinPin}
            onClose={() => setPidiendoAdmin(false)}
          />
        )
      )}
    </ModalShell>
  )
}

