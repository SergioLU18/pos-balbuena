import { vi } from 'vitest'

// Cliente de Supabase falso para las pruebas. setup.js lo pone en lugar de lib/supabase,
// así que los hooks corren su camino REAL (el mismo que en producción) y el test revisa
// dos cosas: qué hizo el hook en el store y qué RPC/consulta mandó al backend.
//
// Por defecto todo contesta { data: null, error: null }. Un test fija otra respuesta con
// responderRpc / responderFrom (p. ej. un error, para probar el rollback).

/** restauranteId con el que setup.js siembra el store. */
export const RESTAURANTE_ID = 'rest-test'

const respuestasRpc = new Map()
const respuestasFrom = new Map()
const OK = { data: null, error: null }

// Constructor de consultas encadenable: cualquier filtro regresa la misma consulta, y al
// hacerle await resuelve con la respuesta fijada para la tabla.
function consulta(tabla) {
  const q = {}
  for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'lte', 'lt', 'gt', 'order', 'limit', 'range', 'maybeSingle', 'single']) {
    q[m] = () => q
  }
  q.then = (resolve, reject) => Promise.resolve(respuestasFrom.get(tabla) ?? OK).then(resolve, reject)
  return q
}

function canal() {
  const c = { on: () => c, subscribe: () => c }
  return c
}

export const sb = {
  rpc: vi.fn((nombre) => Promise.resolve(respuestasRpc.get(nombre) ?? OK)),
  from: vi.fn((tabla) => consulta(tabla)),
  channel: vi.fn(() => canal()),
  removeChannel: vi.fn(),
}

/** Fija lo que contesta una RPC (hasta el siguiente reiniciarSb). */
export function responderRpc(nombre, respuesta) {
  respuestasRpc.set(nombre, { data: null, error: null, ...respuesta })
}

/** Fija lo que contesta una consulta a una tabla (hasta el siguiente reiniciarSb). */
export function responderFrom(tabla, respuesta) {
  respuestasFrom.set(tabla, { data: null, error: null, ...respuesta })
}

/** Parámetros de cada llamada a la RPC `nombre`, en orden. */
export function llamadasRpc(nombre) {
  return sb.rpc.mock.calls.filter(([n]) => n === nombre).map(([, params]) => params)
}

/** Deja que corran los .then() de las RPCs ya disparadas. */
export function vaciarPromesas() {
  return new Promise((r) => setTimeout(r, 0))
}

export function reiniciarSb() {
  respuestasRpc.clear()
  respuestasFrom.clear()
  sb.rpc.mockClear()
  sb.from.mockClear()
  sb.channel.mockClear()
  sb.removeChannel.mockClear()
}
