import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MetodoPagoModal } from './MetodoPagoModal'

describe('MetodoPagoModal', () => {
  it('efectivo y tarjeta piden una confirmación extra antes de disparar onSelect', () => {
    const onSelect = vi.fn()
    render(<MetodoPagoModal total={165} onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Efectivo'))
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByText(/toda/)).toBeInTheDocument()
    expect(screen.getByText(/en efectivo/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Sí, cerrar mesa'))
    expect(onSelect).toHaveBeenCalledWith('efectivo')
  })

  it('"No, volver" en la confirmación regresa a elegir método sin llamar onSelect', () => {
    const onSelect = vi.fn()
    render(<MetodoPagoModal total={165} onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Tarjeta'))
    expect(screen.getByText(/con tarjeta/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('← No, volver'))
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('avisa que el pago por Tali no hace falta registrarlo, con "Tali" resaltado', () => {
    render(<MetodoPagoModal total={165} onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText((_, el) => el.tagName === 'P' && el.textContent.includes('pagó con Tali'))).toBeInTheDocument()
    expect(screen.getByText('Tali').tagName).toBe('STRONG')
  })

  it('"Ambos" pide el desglose y no deja confirmar si no cuadra con el total', () => {
    const onSelect = vi.fn()
    render(<MetodoPagoModal total={165} onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Ambos (efectivo + tarjeta)'))

    fireEvent.change(screen.getByLabelText('Cantidad pagada en efectivo'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Cantidad pagada con tarjeta'), { target: { value: '50' } })
    const confirmar = screen.getByText('Confirmar cierre')
    expect(confirmar).toBeDisabled()
    expect(screen.getByText(/Falta \$15\.00/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Cantidad pagada con tarjeta'), { target: { value: '65' } })
    expect(confirmar).not.toBeDisabled()
    fireEvent.click(confirmar)
    expect(onSelect).toHaveBeenCalledWith('ambos', { efectivo: 100, tarjeta: 65 })
  })
})
