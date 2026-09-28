import { useState } from 'react'
import { ModalShell } from './AdminModal'
import { DiaModal } from './DiaModal'
import { HoraModal } from './HoraModal'
import { Button } from '../ui/Button'
import { StatTile } from './stats/Section'
import { useCierreDia } from '../../hooks/useStats'
import { hoyLocal } from '../../hooks/useBitacora'
import { f, formatearDia, formatearHora12, hora24 } from '../../lib/utils'

const CONTROL = {
  fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 700,
  padding: '10px 12px', minHeight: 44, borderRadius: 11, textAlign: 'left', cursor: 'pointer',
  border: '2px solid var(--jb-line)', background: '#fff', color: 'var(--jb-ink)', width: '100%',
}

const DESDE_DEFAULT = { h: 4, m: 0, ampm: 'PM' }
const HASTA_DEFAULT = { h: 11, m: 0, ampm: 'PM' }

/** Construye el timestamptz (ISO) de `fecha` ("YYYY-MM-DD") + `hora` ({h,m,ampm} en
 *  12h), en hora LOCAL de la tablet — mismo criterio que rangoDelDia/statsRangos.js:
 *  este proyecto no guarda la zona horaria del restaurante, así que el reloj de la
 *  tablet ES el reloj del restaurante. */
function construirISO(fecha, hora) {
  const [y, mo, d] = fecha.split('-').map(Number)
  return new Date(y, mo - 1, d, hora24(hora.h, hora.ampm), hora.m, 0, 0).toISOString()
}

/** "Cierre del Día": corte de caja de un horario del día (no del día completo) —
 *  cuántas cuentas, cuánto en total y desglosado por Efectivo/Tarjeta/Tali/Propina,
 *  juntando salón y para llevar. Ver supabase/cierre_dia.sql. */
export function CierreDiaModal({ onClose }) {
  const [hoy] = useState(hoyLocal)
  const [fecha, setFecha] = useState(hoy)
  const [desde, setDesde] = useState(DESDE_DEFAULT)
  const [hasta, setHasta] = useState(HASTA_DEFAULT)
  const [mostrandoFecha, setMostrandoFecha] = useState(false)
  const [mostrandoDesde, setMostrandoDesde] = useState(false)
  const [mostrandoHasta, setMostrandoHasta] = useState(false)
  const { datos, cargando, error, calcular, limpiar } = useCierreDia()

  const desdeMs = new Date(construirISO(fecha, desde)).getTime()
  const hastaMs = new Date(construirISO(fecha, hasta)).getTime()
  const rangoInvalido = hastaMs <= desdeMs

  function calcularCierre() {
    if (rangoInvalido) return
    calcular(construirISO(fecha, desde), construirISO(fecha, hasta))
  }

  return (
    <>
      <ModalShell width={480} titulo="Cierre del Día" onClose={onClose}>
        {datos ? (
          // Calculado: el modal ya no deja mover fecha/hora — es el resultado de ESE
          // horario. "Cambiar horario" es lo único que regresa a los selectores.
          <>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--jb-ink)', lineHeight: 1.5 }}>
              Entre las {formatearHora12(desde)} y las {formatearHora12(hasta)} del {fecha === hoy ? 'día de hoy' : formatearDia(fecha)} se vendió:
            </p>

            <ResultadoCierre datos={datos} />

            <Button variant="ghost" size="md" onClick={limpiar} style={{ alignSelf: 'flex-start' }}>
              ‹ Cambiar horario
            </Button>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--jb-ink)', lineHeight: 1.4 }}>
              Se realizará el corte de caja del día entre las:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)' }}>Día</span>
              <button type="button" onClick={() => setMostrandoFecha(true)} style={CONTROL}>
                {fecha === hoy ? 'Hoy' : formatearDia(fecha)}
              </button>
            </div>

            <div className="flex" style={{ gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)' }}>Desde</span>
                <button type="button" onClick={() => setMostrandoDesde(true)} style={CONTROL}>
                  {formatearHora12(desde)}
                </button>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)' }}>Hasta</span>
                <button type="button" onClick={() => setMostrandoHasta(true)} style={CONTROL}>
                  {formatearHora12(hasta)}
                </button>
              </div>
            </div>

            {rangoInvalido && (
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#C24A4A' }}>
                "Hasta" debe ser después de "Desde".
              </p>
            )}

            <Button onClick={calcularCierre} disabled={cargando || rangoInvalido} style={{ width: '100%' }}>
              {cargando ? 'Calculando…' : 'Calcular cierre'}
            </Button>

            {error && (
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#C24A4A' }}>
                No se pudo calcular el cierre: {error}
              </p>
            )}
          </>
        )}
      </ModalShell>

      {mostrandoFecha && (
        <DiaModal
          titulo="Día del cierre"
          value={fecha}
          max={hoy}
          onConfirm={(iso) => { setFecha(iso); setMostrandoFecha(false) }}
          onClose={() => setMostrandoFecha(false)}
        />
      )}
      {mostrandoDesde && (
        <HoraModal
          titulo="Desde"
          value={desde}
          onConfirm={(v) => { setDesde(v); setMostrandoDesde(false) }}
          onClose={() => setMostrandoDesde(false)}
        />
      )}
      {mostrandoHasta && (
        <HoraModal
          titulo="Hasta"
          value={hasta}
          onConfirm={(v) => { setHasta(v); setMostrandoHasta(false) }}
          onClose={() => setMostrandoHasta(false)}
        />
      )}
    </>
  )
}

// Qué porcentaje de la venta de un método fue propina — igual que
// sufijoPorcentaje en MetodoPagoModal, pero aquí es la etiqueta principal de la
// línea, no un paréntesis aparte. Sin venta no hay base sobre la que calcular un
// porcentaje, así que se muestra 0%.
function pctPropina(propina, venta) {
  if (!venta) return 0
  return Math.round((propina / venta) * 100)
}

function Linea({ label, valor, fuerte = false }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 12 }}>
      <span style={{ fontSize: 14, fontWeight: fuerte ? 800 : 600, color: fuerte ? 'var(--jb-ink)' : 'var(--jb-ink-soft)' }}>
        {label}
      </span>
      <span style={{ fontSize: 15, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'var(--jb-ink)' }}>
        {f(valor)}
      </span>
    </div>
  )
}

// Una tarjeta por instrumento de pago, con sus 3 renglones en el orden que pidió
// el dueño: el total que hay que contar en caja, cuánto de eso fue propina, y la
// venta neta (sin propina) — en ese orden, no de venta hacia total.
function GrupoMetodo({ titulo, venta, propina, total, etiquetaVentaFinal }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#fff', borderRadius: 14, padding: '12px 14px', border: '2px solid var(--jb-line)' }}>
      <Linea label={`${titulo} Total:`} valor={total} fuerte />
      <Linea label={`Propina (${pctPropina(propina, venta)}%):`} valor={propina} />
      <Linea label={etiquetaVentaFinal} valor={venta} />
    </div>
  )
}

function ResultadoCierre({ datos }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--jb-cream)', borderRadius: 16, padding: '16px 18px' }}>
      <div className="flex items-center justify-between" style={{ gap: 12 }}>
        <StatTile label="Cuentas" valor={datos.cuentas} />
        <StatTile label="Total" valor={f(datos.total)} acento />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <GrupoMetodo
          titulo="Efectivo"
          venta={datos.efectivo_venta}
          propina={datos.efectivo_propina}
          total={datos.efectivo_total}
          etiquetaVentaFinal="Venta Efectivo Total:"
        />
        <GrupoMetodo
          titulo="Tarjeta"
          venta={datos.tarjeta_venta}
          propina={datos.tarjeta_propina}
          total={datos.tarjeta_total}
          etiquetaVentaFinal="Venta Tarjeta Total:"
        />
        <GrupoMetodo
          titulo="Tali"
          venta={datos.tali_venta}
          propina={datos.tali_propina}
          total={datos.tali_total}
          etiquetaVentaFinal="Tali Efectivo Total:"
        />
      </div>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--jb-ink-soft)', lineHeight: 1.4 }}>
        Salón: <strong style={{ color: 'var(--jb-ink)' }}>{f(datos.salon_total)}</strong> ({datos.salon_cuentas} cuenta{datos.salon_cuentas === 1 ? '' : 's'})
        {' '}· Para llevar: <strong style={{ color: 'var(--jb-ink)' }}>{f(datos.llevar_total)}</strong> ({datos.llevar_cuentas} orden{datos.llevar_cuentas === 1 ? '' : 'es'})
      </p>
    </div>
  )
}
