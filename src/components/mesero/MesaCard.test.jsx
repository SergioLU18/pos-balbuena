import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MesaCard } from './MesaCard'

function mesa(extra) {
  return { id: 'mesa-5', numero: '5', estado: 'libre', total: 0, ...extra }
}

describe('MesaCard', () => {
  it('una mesa libre dice que está sin ocupar', () => {
    const { container } = render(<MesaCard mesa={mesa()} />)
    expect(container.textContent).toContain('Sin ocupar')
  })

  it('muestra el total de una cuenta abierta', () => {
    render(<MesaCard mesa={mesa({ estado: 'abierta', total: 165 })} />)
    expect(screen.getByText('$165.00')).toBeInTheDocument()
  })

  it('la principal de un grupo lleva el nombre de todas sus mesas', () => {
    render(<MesaCard mesa={mesa({ numero: '3', unidas: [{ id: 'mesa-4', numero: '4' }] })} />)
    expect(screen.getByText('3 + 4')).toBeInTheDocument()
  })

  it('una secundaria dice a qué mesa está unida, sin estado ni total propios', () => {
    const { container } = render(<MesaCard mesa={mesa({ numero: '4', estado: 'abierta', total: 90, unidaA: { id: 'mesa-3', numero: '3' } })} />)
    expect(container.textContent).toContain('Unida a Mesa 3')
    expect(container.textContent).not.toContain('Cuenta abierta')
    expect(screen.queryByText('$90.00')).not.toBeInTheDocument()
  })
})
