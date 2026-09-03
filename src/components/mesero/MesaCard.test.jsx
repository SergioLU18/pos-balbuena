import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MesaCard } from './MesaCard'

const ROSA = { id: 'mesero-1', nombre: 'Doña Rosa' }
const BETO = { id: 'mesero-2', nombre: 'Don Beto' }

function mesa(extra) {
  return { id: 'mesa-5', numero: '5', estado: 'libre', meseros: [], total: 0, ...extra }
}

describe('MesaCard — quién atiende la mesa', () => {
  it('nombra a los dos meseros de una mesa compartida', () => {
    render(<MesaCard mesa={mesa({ meseros: [ROSA, BETO], compartida: true })} />)
    expect(screen.getByText('Doña Rosa')).toBeInTheDocument()
    expect(screen.getByText('Don Beto')).toBeInTheDocument()
  })

  it('resalta el nombre del mesero que está usando la tablet', () => {
    render(<MesaCard mesa={mesa({ meseros: [ROSA, BETO] })} meseroActualId={BETO.id} />)
    // El propio nombre va en negritas y color de acento para poder barrer el mapa
    // sin leer nombre por nombre; el del compañero se queda en gris.
    expect(screen.getByText('Don Beto')).toHaveStyle({ fontWeight: '800' })
    expect(screen.getByText('Doña Rosa')).not.toHaveStyle({ fontWeight: '800' })
  })

  it('no pinta el renglón cuando la mesa no la atiende nadie', () => {
    const { container } = render(<MesaCard mesa={mesa()} />)
    expect(container.textContent).toContain('Sin ocupar')
    expect(screen.queryByText('Doña Rosa')).not.toBeInTheDocument()
  })

  it('sigue mostrando el total de una cuenta abierta junto a los meseros', () => {
    render(<MesaCard mesa={mesa({ estado: 'abierta', total: 165, meseros: [ROSA] })} />)
    expect(screen.getByText('$165.00')).toBeInTheDocument()
    expect(screen.getByText('Doña Rosa')).toBeInTheDocument()
  })
})
