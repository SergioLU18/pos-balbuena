import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLlevar, totalDeOrden, itemsDeOrden } from './useLlevar'
import { useLlevarStore, useMeseroStore, usePedidosStore, usePosStore } from '../store/appStore'
import { MESEROS } from '../lib/mockMeseros'
import { formatearDireccion } from '../lib/cliente'

beforeEach(() => {
  useLlevarStore.setState({ clientes: [], ordenes: [] })
  usePedidosStore.setState({ pedidos: [] })
  usePosStore.setState({ meseros: MESEROS })
  useMeseroStore.setState({ currentMeseroId: MESEROS[0].id })
})

const DATOS = {
  telefono: '55 1234 5678', nombre: 'Elena', apellidos: 'Ruiz',
  calle: 'Oriente', numero: '168', colonia: 'Centro', codigoPostal: '06000',
}

describe('useLlevar — búsqueda por teléfono', () => {
  it('no encontrar al cliente NO es un error: es el caso del cliente nuevo', async () => {
    const { result } = renderHook(() => useLlevar())
    const { cliente, error } = await result.current.buscarPorTelefono('5599999999')
    expect(cliente).toBeNull()
    expect(error).toBeNull()
  })

  it('encuentra al cliente aunque el teléfono se teclee con otro formato', async () => {
    const { result } = renderHook(() => useLlevar())
    await act(async () => { await result.current.guardarCliente(DATOS) })
    // Se dio de alta con espacios y se busca sin ellos: el teléfono se guarda y se
    // compara siempre normalizado (solo dígitos).
    const { cliente } = await result.current.buscarPorTelefono('5512345678')
    expect(cliente?.nombre).toBe('Elena')
    expect(cliente?.apellidos).toBe('Ruiz')
    expect(formatearDireccion(cliente)).toBe('Oriente 168, Centro, CP 06000')
  })
})

describe('useLlevar — padrón de clientes', () => {
  it('guardar dos veces el mismo teléfono actualiza la ficha en vez de duplicarla', async () => {
    const { result } = renderHook(() => useLlevar())
    await act(async () => { await result.current.guardarCliente(DATOS) })
    await act(async () => {
      await result.current.guardarCliente({ ...DATOS, calle: 'Sur', numero: '24' })
    })
    const { clientes } = useLlevarStore.getState()
    expect(clientes).toHaveLength(1)
    expect(clientes[0].calle).toBe('Sur')
    expect(clientes[0].numero).toBe('24')
  })
})

describe('useLlevar — abrir orden', () => {
  it('abre la orden con los datos del cliente y el mesero del turno', async () => {
    const { result } = renderHook(() => useLlevar())
    let cliente
    await act(async () => { ({ cliente } = await result.current.guardarCliente(DATOS)) })
    await act(async () => { await result.current.crearOrden(cliente) })

    const [orden] = useLlevarStore.getState().ordenes
    expect(orden.estado).toBe('abierta')
    expect(orden.clienteNombre).toBe('Elena Ruiz')
    expect(orden.clienteTelefono).toBe('5512345678')
    // Los datos del cliente se copian a la orden: si después se muda, las órdenes viejas
    // tienen que seguir diciendo a dónde se mandaron.
    expect(orden.direccion).toBe('Oriente 168, Centro, CP 06000')
    expect(orden.meseroNombre).toBe(MESEROS[0].nombre)
  })

  it('el folio es consecutivo, para poder cantarlo en cocina', async () => {
    const { result } = renderHook(() => useLlevar())
    let cliente
    await act(async () => { ({ cliente } = await result.current.guardarCliente(DATOS)) })
    await act(async () => { await result.current.crearOrden(cliente) })
    await act(async () => { await result.current.crearOrden(cliente) })
    expect(useLlevarStore.getState().ordenes.map((o) => o.folio)).toEqual([1, 2])
  })
})

describe('totalDeOrden', () => {
  const orden = { id: 'ol-1', estado: 'abierta', total: 0, items: [] }
  const pedidos = [
    { id: 'p1', ordenLlevarId: 'ol-1', items: [{ id: 'i1', nombre: 'Sope', precio_unitario: 110, cantidad: 2 }] },
    { id: 'p2', ordenLlevarId: 'ol-1', items: [{ id: 'i2', nombre: 'Agua', precio_unitario: 40, cantidad: 1 }] },
    { id: 'p3', ordenLlevarId: 'otra', items: [{ id: 'i3', nombre: 'Taco', precio_unitario: 150, cantidad: 1 }] },
  ]

  it('mientras la orden está abierta se deriva de SUS pedidos', () => {
    expect(itemsDeOrden('ol-1', pedidos, orden)).toHaveLength(2)
    expect(totalDeOrden(orden, pedidos)).toBe(110 * 2 + 40)
  })

  it('una vez cerrada usa el total congelado, aunque ya no queden pedidos', () => {
    const cerrada = { ...orden, estado: 'entregada', total: 260, items: [{ id: 'i1', cantidad: 2 }] }
    expect(totalDeOrden(cerrada, [])).toBe(260)
  })
})
