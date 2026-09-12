import { describe, it, expect } from 'vitest'
import { totalesResumen, proyeccionCierre, bucketizarHeatmap, ventaPorDiaSemana, acumuladoDiario, serieMensualConProyeccion } from './statsCalc'

describe('totalesResumen', () => {
  it('suma salón y llevar', () => {
    const r = { salon_total: 1000, salon_cuentas: 4, llevar_total: 500, llevar_cuentas: 2 }
    expect(totalesResumen(r)).toEqual({ total: 1500, cuentas: 6, ticketPromedio: 250 })
  })

  it('no truena sin datos (rango sin ninguna venta, o RPC sin responder aún)', () => {
    expect(totalesResumen(null)).toEqual({ total: 0, cuentas: 0, ticketPromedio: 0 })
    expect(totalesResumen({})).toEqual({ total: 0, cuentas: 0, ticketPromedio: 0 })
  })
})

describe('proyeccionCierre', () => {
  it('prorratea lo acumulado a los días del mes', () => {
    expect(proyeccionCierre(3000, 10, 30)).toBe(9000)
  })
  it('no truena el día 0 (mes que apenas empieza)', () => {
    expect(proyeccionCierre(0, 0, 30)).toBe(0)
  })
})

// Miércoles 2026-09-16, 2:00pm y 11:00pm locales; jueves 17, 9:00am.
const SERIE = [
  { ocurrido_at: new Date(2026, 8, 16, 14, 0).toISOString(), total: 100 },
  { ocurrido_at: new Date(2026, 8, 16, 23, 0).toISOString(), total: 50 },
  { ocurrido_at: new Date(2026, 8, 17, 9, 0).toISOString(), total: 200 },
]

describe('bucketizarHeatmap', () => {
  it('acumula cada punto en su celda día×hora local', () => {
    const grilla = bucketizarHeatmap(SERIE)
    expect(grilla[3][14]).toEqual({ total: 100, cuentas: 1 }) // miércoles 2pm
    expect(grilla[3][23]).toEqual({ total: 50, cuentas: 1 })  // miércoles 11pm
    expect(grilla[4][9]).toEqual({ total: 200, cuentas: 1 })  // jueves 9am
    expect(grilla[3][13]).toEqual({ total: 0, cuentas: 0 })   // hora sin ventas
  })
})

describe('ventaPorDiaSemana', () => {
  it('agrupa por día sin importar la hora, en orden Lunes→Domingo', () => {
    const porDia = ventaPorDiaSemana(SERIE)
    expect(porDia.map((d) => d.nombre)).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])
    expect(porDia.find((d) => d.nombre === 'Miércoles').total).toBe(150)
    expect(porDia.find((d) => d.nombre === 'Jueves').total).toBe(200)
    expect(porDia.find((d) => d.nombre === 'Lunes').total).toBe(0)
  })
})

describe('acumuladoDiario', () => {
  it('arma el corrido día por día, en orden cronológico', () => {
    const serie = acumuladoDiario(SERIE)
    expect(serie).toEqual([
      { dia: '2026-09-16', total: 150, acumulado: 150 },
      { dia: '2026-09-17', total: 200, acumulado: 350 },
    ])
  })

  it('una serie vacía da una lista vacía, no un corrido en cero', () => {
    expect(acumuladoDiario([])).toEqual([])
  })
})

describe('serieMensualConProyeccion', () => {
  // Mes de 30 días, hoy es el día 10: $100/día los primeros 10 días -> $1000
  // acumulado, proyección lineal a 30 días = $3000.
  const serie = Array.from({ length: 10 }, (_, i) => ({
    ocurrido_at: new Date(2026, 8, i + 1, 12, 0).toISOString(),
    total: 100,
  }))

  it('lo real llega hasta hoy y no más allá', () => {
    const { puntos } = serieMensualConProyeccion(serie, 10, 30)
    expect(puntos[9].real).toBe(1000)  // día 10
    expect(puntos[10].real).toBeNull() // día 11: ya no hay dato real
    expect(puntos[0].real).toBe(100)   // día 1
  })

  it('lo proyectado empieza justo en hoy (mismo valor que lo real) y llega a la proyección final', () => {
    const { puntos, proyeccionFinal } = serieMensualConProyeccion(serie, 10, 30)
    expect(puntos[9].proyectado).toBe(1000)     // se tocan en el día de hoy
    expect(puntos[0].proyectado).toBeNull()     // antes de hoy no hay proyección
    expect(proyeccionFinal).toBe(3000)
    expect(puntos[29].proyectado).toBeCloseTo(3000, 5) // fin de mes
  })

  it('el último día del mes no truena la pendiente (0 días restantes)', () => {
    const { puntos } = serieMensualConProyeccion(serie, 30, 30)
    expect(puntos[29].real).toBe(1000)
    expect(puntos[29].proyectado).toBe(1000)
  })
})
