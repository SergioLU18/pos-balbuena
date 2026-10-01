import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IngredienteChecklist } from './IngredienteChecklist'

const INGREDIENTES = [{ nombre: 'Asado' }, { nombre: 'Chorizo' }, { nombre: 'Frijol' }]

// Estado real para que cada toque se vea reflejado, como en ConfigurarPlatilloModal.
function renderChecklist(max = 2, inicial = []) {
  const estado = { actual: inicial }
  function Harness() {
    const [sel, setSel] = useState(inicial)
    estado.actual = sel
    return <IngredienteChecklist ingredientes={INGREDIENTES} seleccionados={sel} max={max} onChange={setSel} />
  }
  render(<Harness />)
  return estado
}

// El chip del catálogo (no el lugar, que también empieza con el nombre pero trae ✕).
const chip = (nombre) =>
  screen.getAllByRole('button').find((b) => b.textContent.startsWith(nombre) && !b.textContent.includes('✕'))
const lugar = (nombre) =>
  screen.getAllByRole('button').filter((b) => b.textContent.startsWith(`${nombre} ✕`))

describe('IngredienteChecklist — lugares', () => {
  it('muestra un lugar vacío por cada ingrediente que falta', () => {
    renderChecklist(2)
    expect(screen.getByText('Ingrediente 1')).toBeTruthy()
    expect(screen.getByText('Ingrediente 2')).toBeTruthy()
  })

  it('tocar el mismo ingrediente dos veces lo pone doble', async () => {
    const user = userEvent.setup()
    const estado = renderChecklist(2)
    await user.click(chip('Asado'))
    await user.click(chip('Asado'))
    expect(estado.actual).toEqual(['Asado', 'Asado'])
    expect(lugar('Asado')).toHaveLength(2)
    expect(screen.getByText('×2')).toBeTruthy()
  })

  it('quitar un lugar quita solo esa unidad (×2 → ×1)', async () => {
    const user = userEvent.setup()
    const estado = renderChecklist(2, ['Asado', 'Asado'])
    await user.click(lugar('Asado')[0])
    expect(estado.actual).toEqual(['Asado'])
    expect(screen.getByText('Ingrediente 2')).toBeTruthy()
  })

  it('quita el lugar exacto que se tocó, no el primero del mismo nombre', async () => {
    const user = userEvent.setup()
    const estado = renderChecklist(3, ['Asado', 'Chorizo', 'Frijol'])
    await user.click(lugar('Chorizo')[0])
    expect(estado.actual).toEqual(['Asado', 'Frijol'])
  })

  it('con los lugares llenos, tocar el catálogo no cambia nada (ni reemplaza ni quita)', async () => {
    const user = userEvent.setup()
    const estado = renderChecklist(2, ['Asado', 'Chorizo'])
    await user.click(chip('Frijol'))
    await user.click(chip('Asado'))
    expect(estado.actual).toEqual(['Asado', 'Chorizo'])
    expect(chip('Frijol').disabled).toBe(true)
  })
})
