import { useEffect, useState } from 'react'
import { useBitacora, hoyLocal } from '../../hooks/useBitacora'
import { usePosStore } from '../../store/appStore'
import { IS_MOCK } from '../../lib/config'
import { f } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { GRUPOS, describir, esSensible, grupoDe, importe, renglones, sujeto } from '../../lib/eventos'
import { Section } from '../../components/admin/stats/Section'
import { EstadisticasSection } from '../../components/admin/stats/EstadisticasSection'

const FILTROS = [['', 'Todo'], ['operacion', 'Operación'], ['menu', 'Menú'], ['config', 'Configuración']]

const CONTROL = {
  fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 700,
  padding: '10px 12px', minHeight: 44, borderRadius: 11,
  border: '2px solid var(--jb-line)', background: '#fff', color: 'var(--jb-ink)',
}

const chip = (activo) => ({
  fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 800,
  padding: '10px 14px', minHeight: 44, borderRadius: 11, cursor: 'pointer',
  border: `2px solid ${activo ? 'var(--jb-pink)' : 'var(--jb-line)'}`,
  background: activo ? 'var(--jb-pink)' : '#fff',
  color: activo ? '#fff' : 'var(--jb-ink-soft)',
})

const hora = (iso) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

// Alto de la ventana scrolleable cuando la bitácora va encogida arriba de
// Estadísticas — suficiente para ver 4-5 filas sin que la lista de todo el día
// empuje las gráficas kilómetros hacia abajo. "Pantalla completa" es la salida
// para cuando sí hace falta revisarla completa.
const ALTO_ENCOGIDO = 460

// Ajustes → Bitácora: quién hizo qué y cuándo (arriba, en su propia ventana
// scrolleable) y Estadísticas de venta/clientes/patrones (abajo). Solo lectura —
// la bitácora no se edita ni se borra desde ningún lado (ver supabase/bitacora.sql).
export default function AdminBitacoraPage() {
  const meseros = usePosStore((s) => s.meseros)
  // "Hoy" se fija al abrir la pantalla: sirve de día inicial y de tope del selector.
  const [hoy] = useState(hoyLocal)
  const [dia, setDia] = useState(hoy)
  const [meseroId, setMeseroId] = useState('')
  const [grupo, setGrupo] = useState('')
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const bitacora = useBitacora({ dia, meseroId: meseroId || null, grupo: grupo || null })

  // Esc cierra la pantalla completa — es un overlay que tapa todo lo demás, y
  // en una tableta con teclado (o el admin desde una laptop) es el reflejo natural.
  useEffect(() => {
    if (!pantallaCompleta) return
    const onKeyDown = (e) => { if (e.key === 'Escape') setPantallaCompleta(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pantallaCompleta])

  const filtros = { hoy, dia, setDia, meseroId, setMeseroId, grupo, setGrupo, meseros }

  return (
    <div style={{ padding: '20px 24px 48px', maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Section
        title="Bitácora"
        subtitle="Quién hizo qué y cuándo. Los registros no se pueden editar ni borrar."
        action={
          <div className="flex items-center" style={{ gap: 8 }}>
            {!IS_MOCK && <Button variant="secondary" size="md" onClick={bitacora.recargar}>Actualizar</Button>}
            <Button variant="secondary" size="md" onClick={() => setPantallaCompleta(true)}>⤢ Pantalla completa</Button>
          </div>
        }
      >
        <BitacoraFiltros {...filtros} />
        <div style={{ maxHeight: ALTO_ENCOGIDO, overflowY: 'auto', paddingRight: 4 }}>
          <BitacoraCuerpo {...bitacora} dia={dia} hoy={hoy} filtrado={!!(meseroId || grupo)} />
        </div>
      </Section>

      <EstadisticasSection />

      {pantallaCompleta && (
        <BitacoraPantallaCompleta filtros={filtros} bitacora={bitacora} onCerrar={() => setPantallaCompleta(false)} />
      )}
    </div>
  )
}

function BitacoraPantallaCompleta({ filtros, bitacora, onCerrar }) {
  return (
    <div
      role="dialog" aria-modal="true" aria-label="Bitácora, pantalla completa"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200, background: 'var(--jb-cream)',
        display: 'flex', flexDirection: 'column', padding: '20px 24px',
      }}
    >
      <div className="flex items-start justify-between" style={{ gap: 16, marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>Bitácora</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--jb-ink-soft)' }}>
            Quién hizo qué y cuándo. Los registros no se pueden editar ni borrar.
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          {!IS_MOCK && <Button variant="secondary" size="md" onClick={bitacora.recargar}>Actualizar</Button>}
          <Button variant="primary" size="md" onClick={onCerrar}>✕ Cerrar</Button>
        </div>
      </div>
      <div style={{ flexShrink: 0, marginBottom: 16 }}>
        <BitacoraFiltros {...filtros} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', maxWidth: 980, width: '100%', margin: '0 auto' }}>
        <BitacoraCuerpo {...bitacora} dia={filtros.dia} hoy={filtros.hoy} filtrado={!!(filtros.meseroId || filtros.grupo)} />
      </div>
    </div>
  )
}

function BitacoraFiltros({ hoy, dia, setDia, meseroId, setMeseroId, grupo, setGrupo, meseros }) {
  return (
    <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
      <input
        type="date"
        value={dia}
        max={hoy}
        onChange={(e) => e.target.value && setDia(e.target.value)}
        aria-label="Día"
        style={CONTROL}
      />
      <select value={meseroId} onChange={(e) => setMeseroId(e.target.value)} aria-label="Mesero" style={CONTROL}>
        <option value="">Todos los meseros</option>
        {meseros.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
      <div className="flex flex-wrap" style={{ gap: 6 }}>
        {FILTROS.map(([valor, texto]) => (
          <button key={valor || 'todo'} onClick={() => setGrupo(valor)} aria-pressed={grupo === valor} style={chip(grupo === valor)}>
            {texto}
          </button>
        ))}
      </div>
    </div>
  )
}

function BitacoraCuerpo({ eventos, cargando, error, hayMas, cargandoMas, cargarMas, dia, hoy, filtrado }) {
  const [abierto, setAbierto] = useState(null)

  if (IS_MOCK) return <Aviso>La bitácora se guarda en el servidor. En modo demo no se registra nada.</Aviso>
  if (error) return <Aviso tono="error">No se pudo leer la bitácora: {error}</Aviso>
  if (cargando) return <Aviso>Cargando…</Aviso>
  if (!eventos.length) {
    return (
      <Aviso>
        No hay movimientos registrados {dia === hoy ? 'hoy' : 'ese día'}{filtrado ? ' con estos filtros' : ''}.
      </Aviso>
    )
  }

  return (
    <>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {eventos.map((ev) => (
          <Fila key={ev.id} ev={ev} abierto={abierto === ev.id} onToggle={() => setAbierto(abierto === ev.id ? null : ev.id)} />
        ))}
      </ul>
      {hayMas && (
        <div className="flex justify-center" style={{ marginTop: 16 }}>
          <Button variant="secondary" size="md" onClick={cargarMas} disabled={cargandoMas}>
            {cargandoMas ? 'Cargando…' : 'Cargar más'}
          </Button>
        </div>
      )}
    </>
  )
}

function Fila({ ev, abierto, onToggle }) {
  const color = GRUPOS[grupoDe(ev.accion)]?.color ?? 'var(--jb-gray)'
  const monto = importe(ev)
  const lugar = sujeto(ev)
  const sensible = esSensible(ev)
  const expandible = tieneDetalle(ev)
  // Solo es botón si hay algo que desplegar: una fila sin detalle que "se aprieta" y no
  // hace nada confunde más de lo que ayuda.
  const Cabeza = expandible ? 'button' : 'div'

  return (
    <li
      style={{
        background: '#fff', borderRadius: 14, overflow: 'hidden',
        border: '2px solid var(--jb-line)', borderLeft: `6px solid ${color}`,
      }}
    >
      <Cabeza
        {...(expandible ? { type: 'button', onClick: onToggle, 'aria-expanded': abierto } : {})}
        style={{
          all: 'unset', boxSizing: 'border-box', width: '100%',
          display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
          cursor: expandible ? 'pointer' : 'default',
        }}
      >
        <span style={{ width: 50, flexShrink: 0, fontSize: 15, fontWeight: 800, color: 'var(--jb-ink-soft)', fontVariantNumeric: 'tabular-nums' }}>
          {hora(ev.ocurridoAt)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--jb-ink)' }}>
            {sensible && <span title="Conviene revisarlo" style={{ color: 'var(--jb-warn)', marginRight: 6 }}>●</span>}
            {describir(ev)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--jb-ink-soft)', marginTop: 2 }}>
            <strong style={{ color: 'var(--jb-pink-dark)' }}>{ev.meseroNombre ?? 'Sin firma'}</strong>
            {lugar && <> · {lugar}</>}
          </div>
        </div>
        {monto != null && (
          <span style={{ fontSize: 16, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: monto < 0 ? 'var(--jb-queued)' : 'var(--jb-ink)' }}>
            {monto < 0 ? `−${f(-monto)}` : f(monto)}
          </span>
        )}
        {expandible && <span aria-hidden style={{ color: 'var(--jb-gray)', fontWeight: 900, fontSize: 12 }}>{abierto ? '▲' : '▼'}</span>}
      </Cabeza>
      {abierto && <Detalle ev={ev} />}
    </li>
  )
}

function tieneDetalle(ev) {
  return renglones(ev).length > 0 || !!(ev.detalle?.antes && ev.detalle?.despues && !Array.isArray(ev.detalle.antes))
}

function Detalle({ ev }) {
  const items = renglones(ev)
  const { antes, despues } = ev.detalle ?? {}
  return (
    <div style={{ padding: '2px 16px 14px 80px', fontSize: 14, color: 'var(--jb-ink)' }}>
      {items.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((r, i) => (
            <li key={r.id ?? i} className="flex justify-between" style={{ gap: 12 }}>
              <span>
                {r.cantidad}× {r.nombre}
                {r.nota ? <em style={{ color: 'var(--jb-ink-soft)' }}> — {r.nota}</em> : null}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--jb-ink-soft)' }}>
                {f(Number(r.precio_unitario) * Number(r.cantidad))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {antes && despues && !Array.isArray(antes) && <AntesDespues antes={antes} despues={despues} />}
    </div>
  )
}

const CAMPOS = [
  ['nombre', 'Nombre', (v) => v],
  ['categoria', 'Categoría', (v) => v],
  ['precio', 'Precio', (v) => f(v)],
  ['extra', 'Cargo extra', (v) => f(v)],
  ['tiers', 'Niveles', (v) => (Array.isArray(v) ? v.map((t) => `${t.nombre} ${f(t.precio)}`).join(', ') : v)],
  ['activo', 'Activo', (v) => (v ? 'Sí' : 'No')],
  ['es_admin', 'Admin', (v) => (v ? 'Sí' : 'No')],
]

function AntesDespues({ antes, despues }) {
  const filas = CAMPOS.filter(([k]) => k in antes || k in despues)
  const celda = { padding: '3px 12px 3px 0', verticalAlign: 'top' }
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ color: 'var(--jb-ink-soft)', textAlign: 'left' }}>
          <th style={celda} />
          <th style={celda}>Antes</th>
          <th style={celda}>Después</th>
        </tr>
      </thead>
      <tbody>
        {filas.map(([k, etiqueta, fmt]) => {
          const cambio = JSON.stringify(antes[k]) !== JSON.stringify(despues[k])
          const muestra = (v) => (v == null ? '—' : fmt(v))
          return (
            <tr key={k} style={{ fontWeight: cambio ? 800 : 400, color: cambio ? 'var(--jb-ink)' : 'var(--jb-ink-soft)' }}>
              <td style={celda}>{etiqueta}</td>
              <td style={celda}>{muestra(antes[k])}</td>
              <td style={celda}>{muestra(despues[k])}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Aviso({ tono, children }) {
  return (
    <div
      style={{
        padding: '28px 20px', textAlign: 'center', borderRadius: 14, fontSize: 15, fontWeight: 600,
        border: '2px dashed var(--jb-line)', color: 'var(--jb-ink-soft)',
        background: tono === 'error' ? 'var(--jb-warn-bg)' : '#fff',
      }}
    >
      {children}
    </div>
  )
}
