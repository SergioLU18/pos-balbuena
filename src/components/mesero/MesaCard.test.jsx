import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MesaCard } from './MesaCard'

const ROSA = { id: 'mesero-1', nombre: 'Doña Rosa' }
const BETO = { id: 'mesero-2', nombre: 'Don Beto' }

function mesa(extra) {
  return { id: 'mesa-5', numero: '5', estado: 'libre', meseros: [], total: 0, ...extra }
}

describe('MesaCard', () => {
  // Ya no existe la asignación de mesas por mesero: la tarjeta del piso no debe
  // mostrar quién la atiende, ni aunque le lleguen datos de un `mesa.meseros` viejo.
  it('no muestra qué mesero atiende la mesa aunque el dato venga en `mesa.meseros`', () => {
    render(<MesaCard mesa={mesa({ meseros: [ROSA, BETO] })} />)
    expect(screen.queryByText('Doña Rosa')).not.toBeInTheDocument()
    expect(screen.queryByText('Don Beto')).not.toBeInTheDocument()
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

  it('muestra el total de una cuenta abierta', () => {
    render(<MesaCard mesa={mesa({ estado: 'abierta', total: 165 })} />)
    expect(screen.getByText('$165.00')).toBeInTheDocument()
  })
})
