import { describe, it, expect } from 'vitest'
import {
  rangoDia, rangoSemana, rangoMes, rangoPersonalizado,
  rangoAnterior, rangoSemanaPasada, rangoUltimosDias, diaHoraLocal, diasEnMes, diaDelMes,
} from './statsRangos'

// Miércoles 2026-09-16 como fecha de referencia en todo el archivo: cae lejos de
// los bordes de mes/semana, así que cada prueba de rango se compara contra un
// límite calculado a mano y no contra "hoy", que cambiaría la prueba cada día.
const MIE = '2026-09-16'

describe('rangoDia', () => {
  it('cubre exactamente ese día local, medianoche a medianoche', () => {
    const { desde, hasta } = rangoDia(MIE)
    expect(new Date(desde).getDate()).toBe(16)
    expect(new Date(hasta).getDate()).toBe(17)
    expect(new Date(hasta).getTime() - new Date(desde).getTime()).toBe(24 * 60 * 60 * 1000)
  })
})

describe('rangoSemana', () => {
  it('empieza en lunes y dura 7 días, sin importar en qué día de la semana caiga la referencia', () => {
    const { desde, hasta } = rangoSemana(MIE) // miércoles 16 -> semana del lunes 14 al domingo 20
    expect(new Date(desde).getDay()).toBe(1) // lunes
    expect(new Date(desde).getDate()).toBe(14)
    expect(new Date(hasta).getDate()).toBe(21) // lunes siguiente, exclusivo
  })

  it('un domingo pertenece a la semana que empezó el lunes anterior, no a una nueva', () => {
    const { desde } = rangoSemana('2026-09-20') // domingo
    expect(new Date(desde).getDate()).toBe(14)
    expect(new Date(desde).getDay()).toBe(1)
  })
})

describe('rangoMes', () => {
  it('cubre el mes calendario completo', () => {
    const { desde, hasta } = rangoMes(MIE)
    expect(new Date(desde).getDate()).toBe(1)
    expect(new Date(desde).getMonth()).toBe(8) // septiembre = 8
    expect(new Date(hasta).getMonth()).toBe(9) // octubre, exclusivo
  })
})

describe('rangoPersonalizado', () => {
  it('incluye el día de hasta completo, no solo su medianoche', () => {
    const { desde, hasta } = rangoPersonalizado('2026-09-01', '2026-09-05')
    expect(new Date(desde).getDate()).toBe(1)
    expect(new Date(hasta).getDate()).toBe(6) // exclusivo: hasta el fin del día 5
  })
})

describe('rangoAnterior', () => {
  it('un día da el día anterior', () => {
    const dia = rangoDia(MIE)
    const anterior = rangoAnterior(dia)
    expect(anterior.hasta).toBe(dia.desde)
    expect(new Date(anterior.desde).getDate()).toBe(15)
  })

  it('conserva la duración exacta del periodo original', () => {
    const semana = rangoSemana(MIE)
    const anterior = rangoAnterior(semana)
    const dur = (iso) => new Date(iso.hasta).getTime() - new Date(iso.desde).getTime()
    expect(dur(anterior)).toBe(dur(semana))
    expect(anterior.hasta).toBe(semana.desde)
  })
})

describe('rangoSemanaPasada', () => {
  it('recorre el mismo rango exactamente 7 días atrás', () => {
    const dia = rangoDia(MIE)
    const pasada = rangoSemanaPasada(dia)
    expect(new Date(pasada.desde).getDay()).toBe(new Date(dia.desde).getDay()) // mismo día de la semana
    expect(new Date(dia.desde).getTime() - new Date(pasada.desde).getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })
})

describe('rangoUltimosDias', () => {
  it('incluye hoy y los N-1 días anteriores', () => {
    const { desde, hasta } = rangoUltimosDias(30, MIE)
    expect(new Date(hasta).getDate()).toBe(17) // fin del día 16, exclusivo
    const dias = Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / (24 * 60 * 60 * 1000))
    expect(dias).toBe(30)
  })
})

describe('diaHoraLocal', () => {
  it('lee día de la semana y hora del reloj local, no de UTC', () => {
    const iso = new Date(2026, 8, 16, 14, 30).toISOString() // miércoles 2:30pm local
    expect(diaHoraLocal(iso)).toEqual({ dow: 3, hora: 14 })
  })
})

describe('diasEnMes / diaDelMes', () => {
  it('septiembre 2026 tiene 30 días', () => {
    expect(diasEnMes(MIE)).toBe(30)
  })
  it('el día del mes es el número de día, no el índice', () => {
    expect(diaDelMes(MIE)).toBe(16)
  })
})
