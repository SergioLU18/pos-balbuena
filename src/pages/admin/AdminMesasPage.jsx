import { useState } from 'react'
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

// Gestión de mesas (solo admin, dentro de Ajustes): alta, cambio de nombre —acepta
// letras y números, único— y baja. El acomodo del mapa vive en la vista de mesero
// (es una preferencia local por dispositivo, no se administra aquí).
export default function AdminMesasPage() {
  const { mesas, meseros } = useMesas({ ignorarFiltro: true })
  const { crearMesa, renombrarMesa, borrarMesa } = useMesaAdmin()

  const [creando, setCreando] = useState(false)
  const [renombrando, setRenombrando] = useState(null)
  const [borrando, setBorrando] = useState(null)

  // Las mesas "Para llevar" se crean y cierran solas desde el flujo de pedidos.
  const lista = mesas.filter((m) => !esParaLlevar(m.numero))

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
            {lista.length} {lista.length === 1 ? 'mesa' : 'mesas'} · el nombre acepta letras y números
          </p>
        </div>
        <Button size="md" onClick={() => setCreando(true)}>+ Nueva mesa</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {lista.map((m) => {
          const est = ESTADO[m.estado] ?? ESTADO.libre
          const ocupada = m.estado === 'abierta'
          return (
            <div
              key={m.id}
              style={{
                background: '#fff', border: '3px solid var(--jb-line)', borderRadius: 20,
                padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
              }}
            >
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--jb-ink)' }}>{m.numero}</span>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: '#fff', background: est.color,
                  padding: '3px 9px', borderRadius: 999, letterSpacing: 0.3,
                }}>
                  {est.texto}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--jb-ink-soft)', minHeight: 18 }}>
                {ocupada ? `Total en curso: ${f(m.total)}` : 'Sin cuenta'}
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
