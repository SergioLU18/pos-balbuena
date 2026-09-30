import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOrderDraft, buildDraftItem, nombreItem, calcItemPrecio } from './useOrderDraft'
import { usePedidos } from './usePedidos'
import { useOrderStore, usePedidosStore, useAvisosStore, useMesaPagadaStore } from '../store/appStore'
import { sb, responderRpc, llamadasRpc, vaciarPromesas } from '../test/sbFalso'
import { MENU } from '../test/fixtures/menu'
import { MESAS } from '../test/fixtures/mesas'
import { MESEROS } from '../test/fixtures/meseros'

const sope = MENU.find((p) => p.id === 'sope')
const mesa1 = MESAS[0]
const mesero = MESEROS[0]

beforeEach(() => {
  useOrderStore.setState({ drafts: {}, cuentas: {} })
  usePedidosStore.setState({ pedidos: [] })
  useAvisosStore.setState({ avisos: [] })
  useMesaPagadaStore.setState({ pagadas: {} })
})

// Los caminos de error hacen console.error a propósito; los tests que los prueban lo callan.
afterEach(() => console.error.mockRestore?.())

// Deja una mesa como la dejaría Realtime tras un envío a cocina: la cuenta con sus
// renglones planos de cuenta_items y el pedido con los renglones ricos. Ambos se
// emparejan por `nombre`, igual que en el backend.
function sembrarOrdenEnviada(mesa, items, { pedidoId = `ped-${mesa.id}`, estado = 'pendiente' } = {}) {
  const ricos = items.map((it) => ({ ...it, nombre: nombreItem(it), precio_unitario: calcItemPrecio(it) }))
  useOrderStore.setState((s) => ({
    cuentas: {
      ...s.cuentas,
      [mesa.id]: {
        cuentaId: `cuenta-${mesa.id}`,
        items: ricos.map((it, i) => ({ id: `ci-${mesa.id}-${i}`, nombre: it.nombre, precio_unitario: it.precio_unitario, cantidad: it.cantidad })),
        createdAt: new Date().toISOString(),
      },
    },
  }))
  usePedidosStore.setState((s) => ({
    pedidos: [
      ...s.pedidos,
      {
        id: pedidoId, tipo: 'mesa', mesaId: mesa.id, mesaNumero: mesa.numero,
        meseroId: mesero.id, meseroNombre: mesero.nombre, estado,
        enviadoAt: new Date().toISOString(), items: ricos,
      },
    ],
  }))
  return { pedidoId, items: ricos }
}

// La recarga autoritativa (cargarTodo) se nota en que vuelve a consultar los pedidos.
const recargo = () => sb.from.mock.calls.some(([tabla]) => tabla === 'pedidos')

describe('enviarACocina', () => {
  it('manda a cocina la mesa, el mesero y los renglones con nombre y precio, y vacía el draft', async () => {
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    const item = { ...buildDraftItem(sope, 0), modificaOriginal: 'item-viejo' }
    act(() => result.current.agregarItemConstruido(item))
    expect(result.current.draft).toHaveLength(1)

    await act(async () => { result.current.enviarACocina(); await vaciarPromesas() })

    const [params] = llamadasRpc('pos_enviar_orden')
    expect(params).toMatchObject({ p_mesa_id: mesa1.id, p_mesero_id: mesero.id, p_mesero_nombre: mesero.nombre })
    expect(params.p_items).toHaveLength(1)
    expect(params.p_items[0]).toMatchObject({ id: item.id, platilloId: 'sope', nombre: nombreItem(item), precio_unitario: 110 })
    // modificaOriginal es metadata de UI: no viaja al backend.
    expect(params.p_items[0]).not.toHaveProperty('modificaOriginal')
    expect(useOrderStore.getState().drafts[mesa1.id]).toEqual([])
    // La cuenta y el pedido los crea el servidor y llegan por Realtime, no localmente.
    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
  })

  it('no manda nada si el draft está vacío', () => {
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.enviarACocina())
    expect(llamadasRpc('pos_enviar_orden')).toHaveLength(0)
  })

  it('mientras el envío está en vuelo marca "enviando" e ignora un segundo toque', async () => {
    let contestar
    sb.rpc.mockImplementationOnce(() => new Promise((r) => { contestar = r }))
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.agregarItemConstruido(buildDraftItem(sope, 0)))

    act(() => { result.current.enviarACocina(); result.current.enviarACocina() })
    expect(result.current.enviando).toBe(true)
    expect(result.current.draft).toHaveLength(1)

    await act(async () => { contestar({ data: null, error: null }); await vaciarPromesas() })
    expect(llamadasRpc('pos_enviar_orden')).toHaveLength(1)
    expect(result.current.enviando).toBe(false)
    expect(result.current.draft).toEqual([])
  })

  it('si el envío falla, el draft se queda en pantalla y se avisa en la campana', async () => {
    responderRpc('pos_enviar_orden', { error: { message: 'sin red' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.agregarItemConstruido(buildDraftItem(sope, 0)))

    await act(async () => { result.current.enviarACocina(); await vaciarPromesas() })

    expect(result.current.draft).toHaveLength(1)
    expect(result.current.enviando).toBe(false)
    const avisos = useAvisosStore.getState().avisos
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatchObject({ tipo: 'error', mesaId: mesa1.id, titulo: `Mesa ${mesa1.numero} · no se envió la orden` })
  })
})

describe('cerrarMesa', () => {
  it('libera la mesa (sin cuenta) y borra sus pedidos de cocina, para poder abrir una nueva', async () => {
    sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0)])
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    expect(result.current.cuenta).not.toBeNull()

    await act(async () => {
      result.current.cerrarMesa('ambos', { efectivo: 60, tarjeta: 50, propinaEfectivo: 10, propinaTarjeta: 5 })
      await vaciarPromesas()
    })

    expect(llamadasRpc('pos_cerrar_mesa')).toEqual([{
      p_mesa_id: mesa1.id, p_metodo_pago: 'ambos', p_monto_efectivo: 60, p_monto_tarjeta: 50,
      p_propina_efectivo: 10, p_propina_tarjeta: 5, p_mesero_id: mesero.id, p_mesero_nombre: mesero.nombre,
    }])
    expect(result.current.cuenta).toBeNull()
    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
  })

  it('no afecta pedidos ni cuentas de otras mesas', async () => {
    const otraMesa = MESAS[1]
    sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0)])
    sembrarOrdenEnviada(otraMesa, [buildDraftItem(sope, 0)])
    const { result } = renderHook(() => useOrderDraft(mesa1.id))

    await act(async () => { result.current.cerrarMesa('efectivo'); await vaciarPromesas() })

    expect(useOrderStore.getState().cuentas[mesa1.id]).toBeUndefined()
    expect(useOrderStore.getState().cuentas[otraMesa.id]).toBeTruthy()
    expect(usePedidosStore.getState().pedidos.map((p) => p.mesaId)).toEqual([otraMesa.id])
  })

  it('si el cierre falla, la mesa sigue abierta con su cuenta y sus pedidos, y se avisa', async () => {
    responderRpc('pos_cerrar_mesa', { error: { message: 'rechazado' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0)])
    const { result } = renderHook(() => useOrderDraft(mesa1.id))

    await act(async () => { result.current.cerrarMesa('efectivo'); await vaciarPromesas() })

    expect(result.current.cuenta).not.toBeNull()
    expect(usePedidosStore.getState().pedidos).toHaveLength(1)
    expect(useMesaPagadaStore.getState().pagadas[mesa1.id]).toBeUndefined()
    expect(useAvisosStore.getState().avisos[0]).toMatchObject({ tipo: 'error', titulo: `Mesa ${mesa1.numero} · no se pudo cerrar la cuenta` })
  })
})

describe('cambiarCantidadEnviado / quitarItemEnviado — editar un renglón ya enviado', () => {
  it('mientras el pedido sigue en Nuevo (pendiente), permite subir la cantidad y lo refleja en la cuenta', async () => {
    const { pedidoId, items: [item] } = sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0)])
    const { result } = renderHook(() => useOrderDraft(mesa1.id))

    await act(async () => { result.current.cambiarCantidadEnviado(pedidoId, item.id, 1); await vaciarPromesas() })

    expect(usePedidosStore.getState().pedidos[0].items[0].cantidad).toBe(2)
    expect(useOrderStore.getState().cuentas[mesa1.id].items[0].cantidad).toBe(2)
    expect(llamadasRpc('pos_editar_item_pedido')).toEqual([{
      p_pedido_id: pedidoId, p_item_id: item.id, p_cantidad: 2, p_mesero_id: mesero.id, p_mesero_nombre: mesero.nombre,
    }])
  })

  it('fijarCantidadEnviado manda la cantidad absoluta (los −/+ acumulados en el ticket)', async () => {
    const { pedidoId, items: [item] } = sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0)])
    const { result } = renderHook(() => useOrderDraft(mesa1.id))

    await act(async () => { result.current.fijarCantidadEnviado(pedidoId, item.id, 4); await vaciarPromesas() })

    expect(usePedidosStore.getState().pedidos[0].items[0].cantidad).toBe(4)
    expect(useOrderStore.getState().cuentas[mesa1.id].items[0].cantidad).toBe(4)
    expect(llamadasRpc('pos_editar_item_pedido')[0]).toMatchObject({ p_cantidad: 4 })
  })

  it('la cantidad nunca baja de 1 con el stepper (para eso está "Quitar"), y no molesta al backend', () => {
    const { pedidoId, items: [item] } = sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0)])
    const { result } = renderHook(() => useOrderDraft(mesa1.id))

    act(() => result.current.cambiarCantidadEnviado(pedidoId, item.id, -1))

    expect(usePedidosStore.getState().pedidos[0].items[0].cantidad).toBe(1)
    expect(llamadasRpc('pos_editar_item_pedido')).toHaveLength(0)
  })

  it('si el backend rechaza la edición, avisa y recarga desde Supabase para deshacer lo optimista', async () => {
    responderRpc('pos_editar_item_pedido', { error: { message: 'el pedido ya no está pendiente' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { pedidoId, items: [item] } = sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0)])
    const { result } = renderHook(() => useOrderDraft(mesa1.id))

    await act(async () => { result.current.cambiarCantidadEnviado(pedidoId, item.id, 1); await vaciarPromesas() })

    expect(useAvisosStore.getState().avisos[0]).toMatchObject({ tipo: 'error', titulo: `Mesa ${mesa1.numero} · no se pudo cambiar la cantidad` })
    expect(recargo()).toBe(true)
  })

  it('quitar el único renglón de un pedido pendiente borra el pedido completo y el renglón de la cuenta', async () => {
    const { pedidoId, items: [item] } = sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0)])
    const { result } = renderHook(() => useOrderDraft(mesa1.id))

    await act(async () => { result.current.quitarItemEnviado(pedidoId, item.id); await vaciarPromesas() })

    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
    expect(useOrderStore.getState().cuentas[mesa1.id].items).toHaveLength(0)
    expect(llamadasRpc('pos_eliminar_item_pedido')).toEqual([{
      p_pedido_id: pedidoId, p_item_id: item.id, p_mesero_id: mesero.id, p_mesero_nombre: mesero.nombre,
    }])
  })

  it('quitar un renglón deja el resto del pedido intacto', () => {
    const { pedidoId, items: [item1, item2] } = sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0), buildDraftItem(sope, 1)])
    const { result } = renderHook(() => useOrderDraft(mesa1.id))

    act(() => result.current.quitarItemEnviado(pedidoId, item1.id))

    expect(usePedidosStore.getState().pedidos).toHaveLength(1)
    expect(usePedidosStore.getState().pedidos[0].items.map((it) => it.id)).toEqual([item2.id])
    expect(useOrderStore.getState().cuentas[mesa1.id].items.map((c) => c.nombre)).toEqual([item2.nombre])
  })

  it('si la fila de la cuenta junta más piezas del mismo nombre, quitar el renglón solo le resta las suyas', () => {
    const { pedidoId, items: [item] } = sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0)])
    // Otro pedido anterior ya había sumado 2 piezas iguales a la misma fila de cuenta_items.
    useOrderStore.setState((s) => ({
      cuentas: { ...s.cuentas, [mesa1.id]: { ...s.cuentas[mesa1.id], items: [{ ...s.cuentas[mesa1.id].items[0], cantidad: 3 }] } },
    }))
    const { result } = renderHook(() => useOrderDraft(mesa1.id))

    act(() => result.current.quitarItemEnviado(pedidoId, item.id))

    expect(useOrderStore.getState().cuentas[mesa1.id].items[0].cantidad).toBe(2)
  })

  it('si el backend rechaza quitar el renglón, avisa y recarga desde Supabase', async () => {
    responderRpc('pos_eliminar_item_pedido', { error: { message: 'rechazado' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { pedidoId, items: [item] } = sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0)])
    const { result } = renderHook(() => useOrderDraft(mesa1.id))

    await act(async () => { result.current.quitarItemEnviado(pedidoId, item.id); await vaciarPromesas() })

    expect(useAvisosStore.getState().avisos[0]).toMatchObject({ tipo: 'error', titulo: `Mesa ${mesa1.numero} · no se pudo quitar el platillo` })
    expect(recargo()).toBe(true)
  })

  it('una vez que cocina avanzó el pedido a "preparando", el pedido local no cambia y el servidor decide', async () => {
    // El guard real está en el servidor: el hook manda la RPC igual, y al rechazarla
    // recarga para dejar todo como estaba.
    responderRpc('pos_editar_item_pedido', { error: { message: 'el pedido ya no está pendiente' } })
    responderRpc('pos_eliminar_item_pedido', { error: { message: 'el pedido ya no está pendiente' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { pedidoId, items: [item] } = sembrarOrdenEnviada(mesa1, [buildDraftItem(sope, 0)], { estado: 'preparando' })
    const { result } = renderHook(() => useOrderDraft(mesa1.id))

    act(() => result.current.cambiarCantidadEnviado(pedidoId, item.id, 1))
    expect(usePedidosStore.getState().pedidos[0].items[0].cantidad).toBe(1)

    act(() => result.current.quitarItemEnviado(pedidoId, item.id))
    expect(usePedidosStore.getState().pedidos[0].items).toHaveLength(1)

    await act(async () => { await vaciarPromesas() })
    expect(llamadasRpc('pos_editar_item_pedido')).toHaveLength(1)
    expect(llamadasRpc('pos_eliminar_item_pedido')).toHaveLength(1)
    expect(recargo()).toBe(true)
  })
})

describe('usePedidos', () => {
  it('agrupa los pedidos por estado y los ordena del más antiguo al más nuevo', () => {
    usePedidosStore.setState({
      pedidos: [
        { id: 'p1', mesaId: 'mesa-1', mesaNumero: '1', meseroNombre: 'Ana', items: [], enviadoAt: '2026-01-01T10:02:00Z', estado: 'pendiente' },
        { id: 'p2', mesaId: 'mesa-2', mesaNumero: '2', meseroNombre: 'Ana', items: [], enviadoAt: '2026-01-01T10:00:00Z', estado: 'pendiente' },
        { id: 'p3', mesaId: 'mesa-3', mesaNumero: '3', meseroNombre: 'Ana', items: [], enviadoAt: '2026-01-01T10:01:00Z', estado: 'listo' },
      ],
    })
    const { result } = renderHook(() => usePedidos())
    expect(result.current.nuevos.map((p) => p.id)).toEqual(['p2', 'p1'])
    expect(result.current.listos.map((p) => p.id)).toEqual(['p3'])
    expect(result.current.preparando).toEqual([])
  })

  it('avanzarEstado mueve un pedido de pendiente a preparando y lo persiste firmado como "Cocina"', async () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: 'mesa-1', mesaNumero: '1', meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'pendiente' }],
    })
    const { result } = renderHook(() => usePedidos())
    await act(async () => { result.current.avanzarEstado('p1', 'preparando'); await vaciarPromesas() })
    expect(usePedidosStore.getState().pedidos[0].estado).toBe('preparando')
    expect(llamadasRpc('pos_avanzar_pedido')).toEqual([{ p_pedido_id: 'p1', p_estado: 'preparando', p_mesero_nombre: 'Cocina' }])
    expect(recargo()).toBe(false)
  })

  it('si el backend rechaza el avance, recarga desde Supabase para regresar la tarjeta a su columna real', async () => {
    responderRpc('pos_avanzar_pedido', { error: { message: 'rechazado' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: 'mesa-1', mesaNumero: '1', meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'pendiente' }],
    })
    const { result } = renderHook(() => usePedidos())
    await act(async () => { result.current.avanzarEstado('p1', 'preparando'); await vaciarPromesas() })
    expect(recargo()).toBe(true)
  })

  it('en "listos" muestra el que se terminó más reciente arriba, sin importar cuál se pidió primero', () => {
    // p1 se pidió primero (10:00) pero se terminó al final (10:20).
    // p2 se pidió después (10:05) pero se terminó primero (10:10).
    usePedidosStore.setState({
      pedidos: [
        { id: 'p1', mesaId: 'mesa-1', mesaNumero: '1', meseroNombre: 'Ana', items: [], enviadoAt: '2026-01-01T10:00:00Z', estado: 'listo', estadoActualizadoAt: '2026-01-01T10:20:00Z' },
        { id: 'p2', mesaId: 'mesa-2', mesaNumero: '2', meseroNombre: 'Ana', items: [], enviadoAt: '2026-01-01T10:05:00Z', estado: 'listo', estadoActualizadoAt: '2026-01-01T10:10:00Z' },
      ],
    })
    const { result } = renderHook(() => usePedidos())
    expect(result.current.listos.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('avanzarEstado registra cuándo cambió, para poder ordenar "listos" por eso', () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: 'mesa-1', mesaNumero: '1', meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'preparando' }],
    })
    const { result } = renderHook(() => usePedidos())
    act(() => result.current.avanzarEstado('p1', 'listo'))
    expect(usePedidosStore.getState().pedidos[0].estadoActualizadoAt).toBeTruthy()
  })

  it('al recoger un pedido listo (mesero), sale de "listos" y no aparece en ninguna columna', () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: 'mesa-1', mesaNumero: '1', meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'listo' }],
    })
    const { result } = renderHook(() => usePedidos())
    act(() => result.current.avanzarEstado('p1', 'entregado'))
    expect(usePedidosStore.getState().pedidos[0].estado).toBe('entregado')
    expect(result.current.listos).toEqual([])
    expect(result.current.nuevos).toEqual([])
    expect(result.current.preparando).toEqual([])
  })

  it('avanzarEstado guarda la marca de tiempo propia de cada columna (para reiniciar el cronómetro por columna)', () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: 'mesa-1', mesaNumero: '1', meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'pendiente' }],
    })
    const { result } = renderHook(() => usePedidos())

    act(() => result.current.avanzarEstado('p1', 'preparando'))
    expect(usePedidosStore.getState().pedidos[0].preparandoAt).toBeTruthy()

    act(() => result.current.avanzarEstado('p1', 'listo'))
    expect(usePedidosStore.getState().pedidos[0].listoAt).toBeTruthy()
  })

  it('al recoger el pedido, congela listoAt y guarda entregadoAt (para calcular después cuánto esperó en "listo")', () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: 'mesa-1', mesaNumero: '1', meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'listo', listoAt: '2026-01-01T10:00:00Z' }],
    })
    const { result } = renderHook(() => usePedidos())
    act(() => result.current.avanzarEstado('p1', 'entregado'))
    const pedido = usePedidosStore.getState().pedidos[0]
    expect(pedido.listoAt).toBe('2026-01-01T10:00:00Z') // no se toca: es el inicio congelado del tramo "listo"
    expect(pedido.entregadoAt).toBeTruthy()
  })

  it('en "entregados" (backlog) muestra el recogido más reciente arriba', () => {
    usePedidosStore.setState({
      pedidos: [
        { id: 'p1', mesaId: 'mesa-1', mesaNumero: '1', meseroNombre: 'Ana', items: [], enviadoAt: '2026-01-01T10:00:00Z', estado: 'entregado', estadoActualizadoAt: '2026-01-01T10:20:00Z' },
        { id: 'p2', mesaId: 'mesa-2', mesaNumero: '2', meseroNombre: 'Ana', items: [], enviadoAt: '2026-01-01T10:05:00Z', estado: 'entregado', estadoActualizadoAt: '2026-01-01T10:30:00Z' },
      ],
    })
    const { result } = renderHook(() => usePedidos())
    expect(result.current.entregados.map((p) => p.id)).toEqual(['p2', 'p1'])
  })
})
