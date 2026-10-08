import { useMemo, useState } from 'react'
import { useImpresoraStore } from '../../store/appStore'
import { imprimir, estadoImpresora, puedeImprimir } from '../../lib/impresora'
import { ticketPrueba, comandaPrueba } from '../../lib/tickets'
import { NEGOCIO } from '../../lib/negocio'
import { inputStyle } from '../../components/admin/adminStyles'
import { Campo } from '../../components/admin/AdminModal'
import { Button } from '../../components/ui/Button'
import { TicketPreview } from '../../components/ui/TicketPreview'

// Ajustes → Impresora: a qué IP manda esta tablet, si la impresora contesta, si imprime
// la comanda al enviar a cocina, y una prueba de cada ticket. Todo se guarda en la tablet
// (ver useImpresoraStore), así que esta pantalla se configura una vez en cada una.
const MUESTRAS = {
  ticket: { label: 'Ticket', crear: () => ticketPrueba(NEGOCIO) },
  comanda: { label: 'Comanda', crear: () => comandaPrueba() },
}

export default function AdminImpresoraPage() {
  const guardado = useImpresoraStore()
  const [host, setHost] = useState(guardado.host)
  const [puerto, setPuerto] = useState(String(guardado.puerto))
  const [mensaje, setMensaje] = useState(null) // { tipo: 'ok'|'error'|'info', texto }
  const [ocupado, setOcupado] = useState(false)
  const [muestra, setMuestra] = useState('ticket')
  const bloques = useMemo(() => MUESTRAS[muestra].crear(), [muestra])
  const cambios = host.trim() !== guardado.host || Number(puerto) !== guardado.puerto

  function guardar() {
    guardado.setImpresora({ host, puerto })
    setMensaje({ tipo: 'ok', texto: 'Guardado en esta tablet.' })
  }

  async function probarConexion() {
    setOcupado(true)
    setMensaje(null)
    const e = await estadoImpresora({ host: host.trim(), puerto: Number(puerto) || 9100 }).catch(() => null)
    setOcupado(false)
    if (!e) setMensaje({ tipo: 'error', texto: 'No se pudo consultar la impresora.' })
    else if (!e.conectada) setMensaje({ tipo: 'error', texto: `No responde en ${host}:${puerto}. Revisa que esté prendida y en la misma red que la tablet.` })
    else if (!e.detalle) setMensaje({ tipo: 'ok', texto: 'Conectada. (La impresora no reporta estado de papel.)' })
    else if (e.sinPapel) setMensaje({ tipo: 'error', texto: 'Conectada, pero sin papel o con el papel por acabarse.' })
    else if (e.tapaAbierta) setMensaje({ tipo: 'error', texto: 'Conectada, pero con la tapa abierta.' })
    else setMensaje({ tipo: 'ok', texto: 'Conectada y lista.' })
  }

  async function imprimirPrueba() {
    if (cambios) guardado.setImpresora({ host, puerto })
    setOcupado(true)
    const r = await imprimir(bloques)
    setOcupado(false)
    setMensaje(r.ok ? { tipo: 'ok', texto: `${MUESTRAS[muestra].label} de prueba enviada.` } : { tipo: 'error', texto: r.motivo })
  }

  const color = { ok: 'var(--jb-ok)', error: '#A83232', info: 'var(--jb-ink-soft)' }

  return (
    <div style={{ padding: 24, display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <section style={{ flex: '1 1 320px', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>Impresora de tickets</h2>
        {!puedeImprimir() && (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--jb-ink-soft)' }}>
            Estás en el navegador: aquí solo se ve la vista previa. Para imprimir, abre el POS desde la app de la tablet.
          </p>
        )}
        <Campo label="IP de la impresora">
          <input
            style={inputStyle} inputMode="decimal" placeholder="192.168.1.200"
            value={host} onChange={(e) => setHost(e.target.value)}
          />
        </Campo>
        <Campo label="Puerto">
          <input
            style={inputStyle} inputMode="numeric"
            value={puerto} onChange={(e) => setPuerto(e.target.value.replace(/\D/g, ''))}
          />
        </Campo>
        <div className="flex" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Button size="md" variant="secondary" onClick={guardar} disabled={!cambios}>Guardar</Button>
          <Button size="md" variant="secondary" onClick={probarConexion} disabled={ocupado || !host.trim() || !puedeImprimir()}>
            Probar conexión
          </Button>
          <Button size="md" onClick={imprimirPrueba} disabled={ocupado || !host.trim()}>
            Imprimir {MUESTRAS[muestra].label.toLowerCase()} de prueba
          </Button>
        </div>
        {mensaje && (
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: color[mensaje.tipo] }}>{mensaje.texto}</p>
        )}
        <label
          className="flex items-center"
          style={{
            gap: 12, padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
            background: '#fff', border: '2px solid var(--jb-line)',
          }}
        >
          <input
            type="checkbox"
            checked={guardado.comandaAlEnviar}
            onChange={(e) => guardado.setComandaAlEnviar(e.target.checked)}
            style={{ width: 22, height: 22, accentColor: 'var(--jb-pink)', flexShrink: 0 }}
          />
          <span style={{ fontSize: 15, lineHeight: 1.35, color: 'var(--jb-ink)' }}>
            <strong>Imprimir comanda al enviar a cocina</strong>
            <br />
            <span style={{ color: 'var(--jb-ink-soft)' }}>Cada orden que esta tablet manda a cocina sale también en papel.</span>
          </span>
        </label>
      </section>
      <section style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)', marginRight: 4 }}>Vista previa</span>
          {Object.entries(MUESTRAS).map(([clave, m]) => (
            <button
              key={clave}
              type="button"
              onClick={() => setMuestra(clave)}
              style={{
                fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 700,
                padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
                background: muestra === clave ? 'var(--jb-pink)' : '#fff',
                color: muestra === clave ? '#fff' : 'var(--jb-ink)',
                border: `2px solid ${muestra === clave ? 'var(--jb-pink)' : 'var(--jb-line)'}`,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <TicketPreview bloques={bloques} />
      </section>
    </div>
  )
}
