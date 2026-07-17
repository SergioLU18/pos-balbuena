import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfigurarPlatilloModal } from './ConfigurarPlatilloModal'
import { useMenu } from '../../hooks/useMenu'
import { MENU } from '../../lib/mockMenu'

// Render helper con los catálogos globales (como los pasa MeseroOrdenPage vía useMenu).
function renderModal(platillo) {
  let props
  function Harness() {
    const { ingredientes, modificadores, extras } = useMenu()
    props = { ingredientes, modificadores, extras }
    return (
      <ConfigurarPlatilloModal
        platillo={platillo}
        ingredientes={ingredientes}
        modificadores={modificadores}
        extras={extras}
        onConfirm={() => {}}
        onClose={() => {}}
      />
    )
  }
  render(<Harness />)
  return props
}

const dish = (id) => MENU.find((p) => p.id === id)

describe('ConfigurarPlatilloModal — allowlists por platillo', () => {
  it('una bebida no muestra Extras ni Personaliza (no le corresponden)', () => {
    renderModal(dish('bebida'))
    expect(screen.queryByText('Extras')).toBeNull()
    expect(screen.queryByText('Personaliza')).toBeNull()
    // Y ninguno de los extras de comida debe aparecer
    expect(screen.queryByText('Crema')).toBeNull()
    expect(screen.queryByText('Chile Habanero')).toBeNull()
  })

  it('una quesadilla muestra solo sus 2 modificadores, no los de otros platillos', () => {
    renderModal(dish('quesadilla'))
    expect(screen.getByText('Personaliza')).toBeTruthy()
    expect(screen.getByText('Sin Crema')).toBeTruthy()
    expect(screen.getByText('Sin Salsa Verde')).toBeTruthy()
    // La quesadilla no tiene frijol/lechuga que quitar
    expect(screen.queryByText('Sin Frijol')).toBeNull()
    expect(screen.queryByText('Sin Lechuga (Romanita)')).toBeNull()
    // Sí ofrece los extras de comida
    expect(screen.getByText('Extras')).toBeTruthy()
  })
})

describe('mockMenu — integridad de las allowlists', () => {
  it('cada platillo referencia modificadores/extras que existen en el catálogo global', () => {
    const { modificadores, extras } = renderModal(dish('sope')) // props traen catálogos
    const modSet = new Set(modificadores)
    const extraSet = new Set(extras.map((e) => e.nombre))
    for (const p of MENU) {
      for (const m of p.modificadores ?? []) expect(modSet.has(m)).toBe(true)
      for (const e of p.extras ?? []) expect(extraSet.has(e)).toBe(true)
    }
  })
})
