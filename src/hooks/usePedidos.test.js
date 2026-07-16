import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOrderDraft, buildDraftItem } from './useOrderDraft'
import { usePedidos } from './usePedidos'
import { useOrderStore, usePedidosStore, useMeseroStore } from '../store/appStore'
import { MENU } from '../lib/mockMenu'
import { MESAS } from '../lib/mockMesas'
import { MESEROS } from '../lib/mockMeseros'

const sope = MENU.find((p) => p.id === 'sope')
const mesa1 = MESAS[0]

beforeEach(() => {
  useOrderStore.setState({ drafts: {}, cuentas: {} })
  usePedidosStore.setState({ pedidos: [] })
  useMeseroStore.setState({ currentMeseroId: MESEROS[0].id, soloMisMesas: false })
})

describe('enviarACocina', () => {
  it('crea un pedido en cocina con mesa, mesero y hora, y vacía el draft', () => {
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.agregarItemConstruido(buildDraftItem(sope, 0)))
    expect(result.current.draft).toHaveLength(1)

    act(() => result.current.enviarACocina())

    expect(useOrderStore.getState().drafts[mesa1.id]).toEqual([])
    const pedidos = usePedidosStore.getState().pedidos
    expect(pedidos).toHaveLength(1)
    expect(pedidos[0]).toMatchObject({ mesaId: mesa1.id, mesaNumero: mesa1.numero, meseroNombre: MESEROS[0].nombre, estado: 'pendiente' })
    expect(pedidos[0].items).toHaveLength(1)
  })

  it('no crea un pedido si el draft está vacío', () => {
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.enviarACocina())
    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
  })
})

describe('cerrarMesa (temporal, mientras no exista el cierre real desde la app de pagos)', () => {
  it('libera la mesa (sin cuenta) y borra sus pedidos de cocina, para poder abrir una nueva', () => {
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.agregarItemConstruido(buildDraftItem(sope, 0)))
    act(() => result.current.enviarACocina())
    expect(result.current.cuenta).not.toBeNull()
    expect(usePedidosStore.getState().pedidos).toHaveLength(1)

    act(() => result.current.cerrarMesa())

    expect(result.current.cuenta).toBeNull()
    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
  })

  it('no afecta pedidos ni cuentas de otras mesas', () => {
    const otraMesa = MESAS[1]
    const { result: r1 } = renderHook(() => useOrderDraft(mesa1.id))
    const { result: r2 } = renderHook(() => useOrderDraft(otraMesa.id))
    act(() => r1.current.agregarItemConstruido(buildDraftItem(sope, 0)))
    act(() => r1.current.enviarACocina())
    act(() => r2.current.agregarItemConstruido(buildDraftItem(sope, 0)))
    act(() => r2.current.enviarACocina())

    act(() => r1.current.cerrarMesa())

    expect(useOrderStore.getState().cuentas[otraMesa.id]).toBeTruthy()
    expect(usePedidosStore.getState().pedidos.some((p) => p.mesaId === otraMesa.id)).toBe(true)
  })
})

describe('cambiarCantidadEnviado / quitarItemEnviado — editar un renglón ya enviado', () => {
  it('mientras el pedido sigue en Nuevo (pendiente), permite subir la cantidad y lo refleja en la cuenta', () => {
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.agregarItemConstruido(buildDraftItem(sope, 0)))
    act(() => result.current.enviarACocina())
    const pedidoId = usePedidosStore.getState().pedidos[0].id
    const itemId = usePedidosStore.getState().pedidos[0].items[0].id

    act(() => result.current.cambiarCantidadEnviado(pedidoId, itemId, 1))

    expect(usePedidosStore.getState().pedidos[0].items[0].cantidad).toBe(2)
    expect(useOrderStore.getState().cuentas[mesa1.id].items[0].cantidad).toBe(2)
  })

  it('la cantidad nunca baja de 1 con el stepper (para eso está "Quitar")', () => {
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.agregarItemConstruido(buildDraftItem(sope, 0)))
    act(() => result.current.enviarACocina())
    const pedidoId = usePedidosStore.getState().pedidos[0].id
    const itemId = usePedidosStore.getState().pedidos[0].items[0].id

    act(() => result.current.cambiarCantidadEnviado(pedidoId, itemId, -1))

    expect(usePedidosStore.getState().pedidos[0].items[0].cantidad).toBe(1)
  })

  it('quitar el único renglón de un pedido pendiente borra el pedido completo y el renglón de la cuenta', () => {
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.agregarItemConstruido(buildDraftItem(sope, 0)))
    act(() => result.current.enviarACocina())
    const pedidoId = usePedidosStore.getState().pedidos[0].id
    const itemId = usePedidosStore.getState().pedidos[0].items[0].id

    act(() => result.current.quitarItemEnviado(pedidoId, itemId))

    expect(usePedidosStore.getState().pedidos).toHaveLength(0)
    expect(useOrderStore.getState().cuentas[mesa1.id].items).toHaveLength(0)
  })

  it('quitar un renglón deja el resto del pedido intacto', () => {
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.agregarItemConstruido(buildDraftItem(sope, 0)))
    act(() => result.current.agregarItemConstruido(buildDraftItem(sope, 1)))
    act(() => result.current.enviarACocina())
    const pedidoId = usePedidosStore.getState().pedidos[0].id
    const [item1, item2] = usePedidosStore.getState().pedidos[0].items

    act(() => result.current.quitarItemEnviado(pedidoId, item1.id))

    expect(usePedidosStore.getState().pedidos).toHaveLength(1)
    expect(usePedidosStore.getState().pedidos[0].items.map((it) => it.id)).toEqual([item2.id])
  })

  it('una vez que cocina avanzó el pedido a "preparando", editar o quitar un renglón ya no tiene efecto', () => {
    const { result } = renderHook(() => useOrderDraft(mesa1.id))
    act(() => result.current.agregarItemConstruido(buildDraftItem(sope, 0)))
    act(() => result.current.enviarACocina())
    const pedidoId = usePedidosStore.getState().pedidos[0].id
    const itemId = usePedidosStore.getState().pedidos[0].items[0].id
    act(() => usePedidosStore.getState().avanzarEstado(pedidoId, 'preparando'))

    act(() => result.current.cambiarCantidadEnviado(pedidoId, itemId, 1))
    expect(usePedidosStore.getState().pedidos[0].items[0].cantidad).toBe(1)
    expect(useOrderStore.getState().cuentas[mesa1.id].items[0].cantidad).toBe(1)

    act(() => result.current.quitarItemEnviado(pedidoId, itemId))
    expect(usePedidosStore.getState().pedidos[0].items).toHaveLength(1)
    expect(useOrderStore.getState().cuentas[mesa1.id].items).toHaveLength(1)
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

  it('avanzarEstado mueve un pedido de pendiente a preparando', () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', mesaId: 'mesa-1', mesaNumero: '1', meseroNombre: 'Ana', items: [], enviadoAt: new Date().toISOString(), estado: 'pendiente' }],
    })
    const { result } = renderHook(() => usePedidos())
    act(() => result.current.avanzarEstado('p1', 'preparando'))
    expect(usePedidosStore.getState().pedidos[0].estado).toBe('preparando')
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
