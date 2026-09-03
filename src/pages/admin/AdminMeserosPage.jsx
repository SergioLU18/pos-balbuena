import { useState } from 'react'
import { usePosStore, useMeseroStore } from '../../store/appStore'
import { useMeseroAdmin } from '../../hooks/useMeseroAdmin'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { ModalShell, Campo, Toggle } from '../../components/admin/AdminModal'
import { inputStyle } from '../../components/admin/adminStyles'

const porNumero = (a, b) => Number(a) - Number(b)

// Gestión de meseros: alta, edición (nombre, PIN, mesas asignadas, rol admin,
// activo) y baja. Guardas para no quedarse sin admin: no puedes borrarte a ti
// mismo, ni dejar al restaurante sin ningún mesero administrador.
export default function AdminMeserosPage() {
  const meseros = usePosStore((s) => s.meseros)
  const mesas = usePosStore((s) => s.mesas)
  const currentMeseroId = useMeseroStore((s) => s.currentMeseroId)
  const { guardarMesero, borrarMesero } = useMeseroAdmin()

  const [editando, setEditando] = useState(null) // mesero en edición, o {} para nuevo
  const [borrando, setBorrando] = useState(null) // mesero a confirmar borrado

  const numerosMesa = mesas.map((m) => m.numero).sort(porNumero)
  const adminsActivos = meseros.filter((m) => m.esAdmin && m.activo !== false)
  const esUltimoAdmin = (m) => m.esAdmin && adminsActivos.length <= 1

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
          </p>
        </div>
        <Button size="md" onClick={() => setEditando({})}>+ Nuevo mesero</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {meseros.map((m) => (
          <MeseroCard
            key={m.id}
            mesero={m}
            esActual={m.id === currentMeseroId}
            onEdit={() => setEditando(m)}
            onDelete={() => setBorrando(m)}
          />
        ))}
      </div>

      {editando && (
        <MeseroModal
          mesero={editando}
          numerosMesa={numerosMesa}
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

function MeseroCard({ mesero, esActual, onEdit, onDelete }) {
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
        {mesero.mesas?.length ? `Mesas: ${[...mesero.mesas].sort(porNumero).join(', ')}` : 'Sin mesas asignadas'}
      </div>
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

function MeseroModal({ mesero, numerosMesa, esUltimoAdmin, onGuardar, onClose }) {
  const esNuevo = !mesero.id
  const [nombre, setNombre] = useState(mesero.nombre ?? '')
  const [pin, setPin] = useState(mesero.pin ?? '')
  const [mesasSel, setMesasSel] = useState(mesero.mesas ?? [])
  const [esAdmin, setEsAdmin] = useState(!!mesero.esAdmin)
  const [activo, setActivo] = useState(mesero.activo !== false)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  function toggleMesa(n) {
    setMesasSel((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))
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
    <ModalShell onClose={onClose} titulo={esNuevo ? 'Nuevo mesero' : `Editar ${mesero.nombre}`}>
      <Campo label="Nombre">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} placeholder="Ej. Doña Rosa" />
      </Campo>

      <Campo label="PIN (4 dígitos, opcional)">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          style={inputStyle}
          placeholder="1234"
        />
      </Campo>

      <Campo label="Mesas asignadas">
        {numerosMesa.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--jb-gray)' }}>No hay mesas creadas todavía.</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {numerosMesa.map((n) => (
              <Chip key={n} active={mesasSel.includes(n)} onClick={() => toggleMesa(n)}>{n}</Chip>
            ))}
          </div>
        )}
      </Campo>

      <div className="flex" style={{ gap: 20, flexWrap: 'wrap' }}>
        <Toggle checked={esAdmin} onChange={setEsAdmin} label="Administrador (edita meseros y menú)" />
        <Toggle checked={activo} onChange={setActivo} label="Activo" />
      </div>

      {error && <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#C24A4A' }}>{error}</p>}

      <div className="flex" style={{ gap: 12, marginTop: 6 }}>
        <Button variant="secondary" size="md" style={{ flex: 1 }} onClick={onClose}>Cancelar</Button>
        <Button size="md" style={{ flex: 1 }} disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </ModalShell>
  )
}

