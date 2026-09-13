import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TelefonoPad } from './TelefonoPad'

function pad(props) {
  const handlers = { onDigito: vi.fn(), onBorrar: vi.fn(), onLimpiar: vi.fn(), onBuscar: vi.fn() }
  render(<TelefonoPad valor="5512345678" {...handlers} {...props} />)
  return handlers
}

describe('TelefonoPad — bloqueado', () => {
  it('con la ficha abierta ninguna tecla cambia el número', () => {
    const h = pad({ valor: '551234567', bloqueado: true })
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(h.onDigito).not.toHaveBeenCalled()
    expect(h.onBorrar).not.toHaveBeenCalled()
    expect(h.onLimpiar).not.toHaveBeenCalled()
  })

  it('tampoco deja buscar', () => {
    const h = pad({ bloqueado: true })
    expect(screen.getByRole('button', { name: 'Buscar cliente' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar cliente' }))
    expect(h.onBuscar).not.toHaveBeenCalled()
  })

  it('sin bloquear, borrar sí funciona', () => {
    const h = pad()
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(h.onBorrar).toHaveBeenCalledTimes(1)
  })
})
