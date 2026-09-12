import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMesas } from '../../hooks/useMesas'
import { useMesasUnidas } from '../../hooks/useMesasUnidas'
import { useVertical } from '../../hooks/useVertical'
import { useLlevarStore } from '../../store/appStore'
import { puedeSerPrincipal, puedeUnirse, nombreGrupo } from '../../lib/mesasUnidas'
import { f } from '../../lib/utils'
import { MesaCard, MESA_CARD_W } from '../../components/mesero/MesaCard'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { IconUnirMesas, IconParaLlevar } from '../../components/ui/icons'

const botonHeader = {
  fontFamily: "'Inter Tight', sans-serif", fontSize: 16, fontWeight: 800,
  padding: '14px 20px', borderRadius: 16, cursor: 'pointer', whiteSpace: 'nowrap',
  display: 'inline-flex', alignItems: 'center', gap: 8,
}

export default function MeseroFloorPage() {
  const navigate = useNavigate()
  const vertical = useVertical()
  // Modo "Unir mesas": null = apagado. Paso 1 elige la principal (principalId null);
  // paso 2 marca las que se le juntan.
  const [unir, setUnir] = useState(null)
  const [confirmandoUnion, setConfirmandoUnion] = useState(false)
  const { mesas, mesero } = useMesas()
  const { unirMesas } = useMesasUnidas()
  // Las órdenes para llevar no tienen mesa que pintar en este listado, así que aquí solo
  // va la cuenta: el badge es lo que evita que una orden de mostrador se quede olvidada
  // porque nada en esta pantalla la menciona.
  const llevarAbiertas = useLlevarStore((s) => s.ordenes).filter((o) => o.estado === 'abierta').length

  const principal = unir?.principalId ? mesas.find((m) => m.id === unir.principalId) ?? null : null
  const elegidas = unir ? mesas.filter((m) => unir.secundarias.includes(m.id)) : []

  function deshabilitada(mesa) {
    if (!unir) return false
    if (!principal) return !puedeSerPrincipal(mesa)
    return mesa.id !== principal.id && !puedeUnirse(mesas, mesa, principal.id)
  }

  function tocarMesa(mesa) {
    // Una secundaria no tiene cuenta propia: tocarla abre la de su principal.
    if (!unir) return navigate(`/mesero/orden/${mesa.unidaA?.id ?? mesa.id}`)
    if (deshabilitada(mesa)) return
    if (!principal) return setUnir({ principalId: mesa.id, secundarias: [] })
    // Volver a tocar la principal la suelta, para poder elegir otra sin cancelar todo.
    if (mesa.id === principal.id) return setUnir({ principalId: null, secundarias: [] })
    setUnir((u) => ({
      ...u,
      secundarias: u.secundarias.includes(mesa.id)
        ? u.secundarias.filter((id) => id !== mesa.id)
        : [...u.secundarias, mesa.id],
    }))
  }

  // Lo que dice el modal de confirmación. Si alguna de las mesas que se juntan ya trae
  // cuenta, se dice cuánto pasa a la principal: es dinero que cambia de cuenta.
  function textoUnion() {
    const nombres = elegidas.map((m) => m.numero).join(', ')
    const titulo = `¿Unir ${elegidas.length === 1 ? 'la Mesa' : 'las mesas'} ${nombres} a la Mesa ${principal.numero}?`
    const conCuenta = elegidas.filter((m) => m.estado === 'abierta')
    const mensaje = conCuenta.length
      ? `Lo ya pedido en ${conCuenta.map((m) => `Mesa ${m.numero} (${f(m.total)})`).join(', ')} pasa a la cuenta de la Mesa ${principal.numero}.`
      : `Todo lo que se pida en cualquiera de ellas irá a la cuenta de la Mesa ${principal.numero}.`
    return { titulo, mensaje }
  }

  function confirmarUnion() {
    setConfirmandoUnion(false)
    unirMesas(principal.id, unir.secundarias).then(({ error }) => {
      if (!error) setUnir(null)
    })
  }

  const instruccion = !principal
    ? 'Toca la mesa principal: ahí quedará la cuenta del grupo.'
    : elegidas.length === 0
    ? `Toca las mesas que se juntan a la Mesa ${principal.numero}.`
    : `Quedará: Mesa ${nombreGrupo(principal.numero, [...principal.unidas, ...elegidas])}`

  return (
    <div className="h-full flex flex-col" style={{ padding: vertical ? '20px 20px' : '24px 32px' }}>
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--jb-ink)' }}>Mesas</h1>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--jb-ink-soft)' }}>
            {mesero ? `Atendiendo como ${mesero.nombre}` : ''}
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 12 }}>
          <button
            onClick={() => setUnir(unir ? null : { principalId: null, secundarias: [] })}
            style={{
              ...botonHeader,
              border: `2.5px solid ${unir ? 'var(--jb-pink)' : 'var(--jb-line)'}`,
              background: unir ? 'var(--jb-pink)' : '#fff',
              color: unir ? '#fff' : 'var(--jb-ink)',
            }}
          >
            <IconUnirMesas /> Unir mesas
          </button>
          <button
            onClick={() => navigate('/mesero/llevar')}
            style={{
              ...botonHeader,
              position: 'relative',
              border: '2.5px solid var(--jb-pink-light)', background: 'var(--jb-pink-tint)',
              color: 'var(--jb-pink-dark)',
            }}
          >
            <IconParaLlevar /> Para llevar
            {llevarAbiertas > 0 && (
              <span
                style={{
                  position: 'absolute', top: -8, right: -8, minWidth: 24, height: 24, borderRadius: 12,
                  background: 'var(--jb-pink)', color: '#fff', fontSize: 13, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
                }}
              >
                {llevarAbiertas}
              </span>
            )}
          </button>
        </div>
      </div>

      {unir && (
        <div
          className="flex items-center flex-shrink-0"
          style={{
            gap: 12, marginBottom: 18, padding: '12px 16px', borderRadius: 16, flexWrap: 'wrap',
            background: 'var(--jb-pink-tint)', border: '2px solid var(--jb-pink-light)',
          }}
        >
          <span style={{ flex: 1, minWidth: 200, fontSize: 16, fontWeight: 800, color: 'var(--jb-pink-dark)' }}>
            {instruccion}
          </span>
          <button
            onClick={() => setUnir(null)}
            style={{ ...botonHeader, padding: '10px 18px', border: '2.5px solid var(--jb-line)', background: '#fff', color: 'var(--jb-ink)' }}
          >
            Cancelar
          </button>
          {principal && (
            <button
              onClick={() => setConfirmandoUnion(true)}
              disabled={elegidas.length === 0}
              style={{
                ...botonHeader, padding: '10px 18px', border: 'none',
                background: 'var(--jb-pink)', color: '#fff',
                opacity: elegidas.length === 0 ? 0.4 : 1,
                cursor: elegidas.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Unir
            </button>
          )}
        </div>
      )}

      {mesas.length === 0 ? (
        <p style={{ fontSize: 15, color: 'var(--jb-gray)' }}>
          Todavía no hay mesas. Un administrador las crea en Ajustes → Mesas.
        </p>
      ) : (
        <div
          className="flex-1 min-h-0 no-scrollbar"
          style={{
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${MESA_CARD_W}px, 1fr))`,
            gap: 18,
            alignContent: 'start',
            // Aire para el anillo y la palomita de la tarjeta seleccionada en modo unir.
            padding: unir ? 10 : 0,
          }}
        >
          {mesas.map((mesa) => (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              onClick={() => tocarMesa(mesa)}
              seleccionada={!!unir && (mesa.id === unir.principalId || unir.secundarias.includes(mesa.id))}
              deshabilitada={deshabilitada(mesa)}
            />
          ))}
        </div>
      )}

      {confirmandoUnion && principal && elegidas.length > 0 && (
        <ConfirmModal
          {...textoUnion()}
          confirmarLabel="Unir mesas"
          cancelarLabel="Volver"
          onConfirm={confirmarUnion}
          onClose={() => setConfirmandoUnion(false)}
        />
      )}
    </div>
  )
}
