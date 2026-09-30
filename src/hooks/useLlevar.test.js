import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLlevar, totalDeOrden, itemsDeOrden } from './useLlevar'
import { useLlevarStore, useMeseroStore, useOrderStore, usePedidosStore, usePosStore } from '../store/appStore'
import { MESEROS } from '../test/fixtures/meseros'
import { formatearDireccion } from '../lib/cliente'
import { sb, RESTAURANTE_ID, responderRpc, responderFrom, llamadasRpc } from '../test/sbFalso'

beforeEach(() => {
  useLlevarStore.setState({ clientes: [], ordenes: [] })
  usePedidosStore.setState({ pedidos: [] })
  usePosStore.setState({ meseros: MESEROS })
  useMeseroStore.setState({ currentMeseroId: MESEROS[0].id })
})

// Los caminos de error hacen console.error; se silencia para no ensuciar la salida.
function silenciarConsola() {
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

const DATOS = {
  telefono: '55 1234 5678', nombre: 'Elena', apellidos: 'Ruiz',
  calle: 'Oriente', numero: '168', colonia: 'Centro', codigoPostal: '06000',
}

// Fila de `clientes` tal como la devuelve Supabase (snake_case).
const FILA_CLIENTE = {
  id: 'cli-1', restaurante_id: RESTAURANTE_ID, telefono: '5512345678', nombre: 'Elena',
  apellidos: 'Ruiz', calle: 'Oriente', numero: '168', cruzamientos: null, colonia: 'Centro',
  codigo_postal: '06000', cumpleanos: null, genero: null, nota: null, activo: true,
}

// Fila de `ordenes_llevar` tal como la devuelve pos_crear_orden_llevar: el backend copia
// los datos del cliente y asigna el folio.
function filaOrden(extra = {}) {
  return {
    id: 'ol-1', folio: 7, restaurante_id: RESTAURANTE_ID, cliente_id: 'cli-1',
    cliente_nombre: 'Elena Ruiz', cliente_telefono: '5512345678',
    direccion: 'Oriente 168, Centro, CP 06000', mesero_id: MESEROS[0].id,
    mesero_nombre: MESEROS[0].nombre, estado: 'abierta', metodo_pago: null, total: '0',
    items_snapshot: null, created_at: '2026-09-29T18:00:00Z', closed_at: null,
    ...extra,
  }
}

describe('useLlevar — búsqueda por teléfono', () => {
  it('no encontrar al cliente NO es un error: es el caso del cliente nuevo', async () => {
    const { result } = renderHook(() => useLlevar())
    const { cliente, error } = await result.current.buscarPorTelefono('5599999999')
    expect(cliente).toBeNull()
    expect(error).toBeNull()
    expect(sb.from).toHaveBeenCalledWith('clientes')
  })

  it('un teléfono vacío (o sin dígitos) ni siquiera consulta', async () => {
    const { result } = renderHook(() => useLlevar())
    const { cliente, error } = await result.current.buscarPorTelefono('  -  ')
    expect(cliente).toBeNull()
    expect(error).toBeNull()
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('mapea la fila encontrada a la forma de la app', async () => {
    responderFrom('clientes', { data: FILA_CLIENTE })
    const { result } = renderHook(() => useLlevar())
    const { cliente } = await result.current.buscarPorTelefono('55 1234 5678')
    expect(sb.from).toHaveBeenCalledWith('clientes')
    expect(cliente?.nombre).toBe('Elena')
    expect(cliente?.apellidos).toBe('Ruiz')
    expect(cliente?.codigoPostal).toBe('06000')
    expect(formatearDireccion(cliente)).toBe('Oriente 168, Centro, CP 06000')
  })

  it('una falla de la consulta se devuelve como error', async () => {
    silenciarConsola()
    responderFrom('clientes', { error: { message: 'sin red' } })
    const { result } = renderHook(() => useLlevar())
    const { cliente, error } = await result.current.buscarPorTelefono('5512345678')
    expect(cliente).toBeNull()
    expect(error).toBe('sin red')
  })
})

describe('useLlevar — padrón de clientes', () => {
  it('guarda con el teléfono normalizado, firmado, y deja la ficha en el padrón local', async () => {
    responderRpc('pos_guardar_cliente', { data: 'cli-1' })
    const { result } = renderHook(() => useLlevar())
    await act(async () => { await result.current.guardarCliente({ ...DATOS, nombre: ' Elena ' }) })

    const [params] = llamadasRpc('pos_guardar_cliente')
    expect(params).toMatchObject({
      p_mesero_id: MESEROS[0].id, p_mesero_nombre: MESEROS[0].nombre,
      p_restaurante_id: RESTAURANTE_ID, p_telefono: '5512345678',
      // Los opcionales vacíos viajan como null, no como ''.
      p_cruzamientos: null, p_cumpleanos: null, p_genero: null, p_nota: null,
    })
    // Al padrón local en el acto (con el id que dio el backend), sin esperar a Realtime.
    const { clientes } = useLlevarStore.getState()
    expect(clientes).toHaveLength(1)
    expect(clientes[0]).toMatchObject({ id: 'cli-1', telefono: '5512345678', nombre: 'Elena' })
  })

  it('guardar dos veces el mismo teléfono actualiza la ficha en vez de duplicarla', async () => {
    // El upsert por (restaurante, teléfono) lo hace el RPC, que devuelve el mismo id.
    responderRpc('pos_guardar_cliente', { data: 'cli-1' })
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

  it('si el RPC falla no toca el padrón local', async () => {
    silenciarConsola()
    responderRpc('pos_guardar_cliente', { error: { message: 'falta la colonia' } })
    const { result } = renderHook(() => useLlevar())
    let res
    await act(async () => { res = await result.current.guardarCliente(DATOS) })
    expect(res).toEqual({ cliente: null, error: 'falta la colonia' })
    expect(useLlevarStore.getState().clientes).toHaveLength(0)
  })
})

describe('useLlevar — abrir orden', () => {
  const CLIENTE = { id: 'cli-1', telefono: '5512345678', nombre: 'Elena', apellidos: 'Ruiz' }

  it('abre la orden a nombre del mesero del turno y mete la fila devuelta al store', async () => {
    responderRpc('pos_crear_orden_llevar', { data: filaOrden() })
    const { result } = renderHook(() => useLlevar())
    let res
    await act(async () => { res = await result.current.crearOrden(CLIENTE) })

    expect(llamadasRpc('pos_crear_orden_llevar')).toEqual([{
      p_restaurante_id: RESTAURANTE_ID, p_cliente_id: 'cli-1',
      p_mesero_id: MESEROS[0].id, p_mesero_nombre: MESEROS[0].nombre,
    }])
    expect(res).toEqual({ ordenId: 'ol-1', error: null })

    const [orden] = useLlevarStore.getState().ordenes
    expect(orden.estado).toBe('abierta')
    expect(orden.clienteId).toBe('cli-1')
    expect(orden.clienteNombre).toBe('Elena Ruiz')
    expect(orden.clienteTelefono).toBe('5512345678')
    // Los datos del cliente se copian a la orden (eso lo hace el backend): si después se
    // muda, las órdenes viejas tienen que seguir diciendo a dónde se mandaron.
    expect(orden.direccion).toBe('Oriente 168, Centro, CP 06000')
    expect(orden.meseroNombre).toBe(MESEROS[0].nombre)
    expect(orden.total).toBe(0)
    expect(orden.items).toEqual([])
  })

  it('el folio es el que asigna el backend (consecutivo por restaurante)', async () => {
    responderRpc('pos_crear_orden_llevar', { data: filaOrden({ folio: 42 }) })
    const { result } = renderHook(() => useLlevar())
    await act(async () => { await result.current.crearOrden(CLIENTE) })
    expect(useLlevarStore.getState().ordenes[0].folio).toBe(42)
  })

  it('si el RPC falla no deja una orden fantasma en el store', async () => {
    silenciarConsola()
    responderRpc('pos_crear_orden_llevar', { error: { message: 'cliente dado de baja' } })
    const { result } = renderHook(() => useLlevar())
    let res
    await act(async () => { res = await result.current.crearOrden(CLIENTE) })
    expect(res).toEqual({ ordenId: null, error: 'cliente dado de baja' })
    expect(useLlevarStore.getState().ordenes).toHaveLength(0)
  })
})

describe('useLlevar — borrar cliente', () => {
  const CLIENTE = { id: 'cli-1', telefono: '5512345678', nombre: 'Elena' }
  // Orden abierta del cliente, ya en la forma de la app (como la deja crearOrden).
  const ABIERTA = { id: 'ol-1', clienteId: 'cli-1', estado: 'abierta', items: [], createdAt: '2026-09-29T18:00:00Z' }

  beforeEach(() => {
    useLlevarStore.setState({ clientes: [CLIENTE], ordenes: [ABIERTA] })
    useOrderStore.setState({ drafts: {} })
  })

  it('una orden abierta SIN platillos no bloquea la baja: se descarta con ella', async () => {
    // Un borrador a medio tomar en la orden vacía también se tira.
    useOrderStore.getState().addDraftItem('ol-1', { id: 'd1', cantidad: 1 })
    const { result } = renderHook(() => useLlevar())

    let error
    await act(async () => { ({ error } = await result.current.borrarCliente('cli-1')) })
    expect(error).toBeNull()
    expect(llamadasRpc('pos_desactivar_cliente')).toEqual([{
      p_cliente_id: 'cli-1', p_mesero_id: MESEROS[0].id, p_mesero_nombre: MESEROS[0].nombre,
    }])
    expect(useLlevarStore.getState().clientes).toHaveLength(0)
    expect(useLlevarStore.getState().ordenes).toHaveLength(0)
    expect(useOrderStore.getState().getDraft('ol-1')).toEqual([])
  })

  it('una orden abierta CON platillos en cocina sí la bloquea, sin llamar al backend', async () => {
    usePedidosStore.setState({
      pedidos: [{ id: 'p1', ordenLlevarId: 'ol-1', items: [{ id: 'i1', precio_unitario: 110, cantidad: 1 }] }],
    })
    const { result } = renderHook(() => useLlevar())

    let error
    await act(async () => { ({ error } = await result.current.borrarCliente('cli-1')) })
    expect(error).toBeTruthy()
    expect(llamadasRpc('pos_desactivar_cliente')).toHaveLength(0)
    expect(useLlevarStore.getState().clientes).toHaveLength(1)
    expect(useLlevarStore.getState().ordenes[0].estado).toBe('abierta')
  })

  it('si el RPC falla no quita ni al cliente ni su orden vacía', async () => {
    silenciarConsola()
    responderRpc('pos_desactivar_cliente', { error: { message: 'sin red' } })
    const { result } = renderHook(() => useLlevar())

    let error
    await act(async () => { ({ error } = await result.current.borrarCliente('cli-1')) })
    expect(error).toBe('sin red')
    expect(useLlevarStore.getState().clientes).toHaveLength(1)
    expect(useLlevarStore.getState().ordenes).toHaveLength(1)
  })
})

describe('useLlevar — historial', () => {
  it('consulta ordenes_llevar y mapea la copia congelada de cada orden', async () => {
    responderFrom('ordenes_llevar', {
      data: [filaOrden({
        estado: 'entregada', total: '260', metodo_pago: 'efectivo', closed_at: '2026-09-29T19:00:00Z',
        items_snapshot: [{ id: 'i1', nombre: 'Sope', precio_unitario: 130, cantidad: 2 }],
      })],
    })
    const { result } = renderHook(() => useLlevar())
    const { historial, error } = await result.current.historialCliente('cli-1')
    expect(sb.from).toHaveBeenCalledWith('ordenes_llevar')
    expect(error).toBeNull()
    expect(historial).toHaveLength(1)
    // total llega como numeric (texto) y se convierte; los renglones salen del snapshot.
    expect(historial[0]).toMatchObject({ estado: 'entregada', total: 260, metodoPago: 'efectivo' })
    expect(totalDeOrden(historial[0], [])).toBe(260)
    expect(historial[0].items).toHaveLength(1)
  })

  it('una falla de la consulta devuelve historial vacío y el error', async () => {
    silenciarConsola()
    responderFrom('ordenes_llevar', { error: { message: 'sin red' } })
    const { result } = renderHook(() => useLlevar())
    const { historial, error } = await result.current.historialCliente('cli-1')
    expect(historial).toEqual([])
    expect(error).toBe('sin red')
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
