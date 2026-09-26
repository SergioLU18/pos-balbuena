import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MetodoPagoModal } from './MetodoPagoModal'

describe('MetodoPagoModal', () => {
  it('efectivo pasa por propina y confirmación con desglose antes de disparar onSelect', () => {
    const onSelect = vi.fn()
    render(<MetodoPagoModal total={165} onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Todo en efectivo'))
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Propina' })).toBeInTheDocument()

    // El default es por porcentaje; se cambia a monto fijo para este caso.
    fireEvent.click(screen.getByText('Cantidad'))
    fireEvent.change(screen.getByLabelText('Propina'), { target: { value: '20' } })
    fireEvent.click(screen.getByText('Continuar'))

    expect(screen.getByText('Confirmación')).toBeInTheDocument()
    expect(screen.getByText(/en efectivo/)).toBeInTheDocument()
    expect(screen.getByText('$185.00')).toBeInTheDocument() // total a cobrar: 165 + 20
    expect(screen.getByText('Propina (12.1%)')).toBeInTheDocument() // 20 / 165, aunque se capturó por monto

    fireEvent.click(screen.getByText('Sí, cerrar mesa'))
    expect(onSelect).toHaveBeenCalledWith('efectivo', { propinaEfectivo: 20, propinaTarjeta: 0 })
  })

  it('sin capturar propina, cuenta como $0 y el total a cobrar es el de la cuenta', () => {
    const onSelect = vi.fn()
    render(<MetodoPagoModal total={165} onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Todo en tarjeta'))
    fireEvent.click(screen.getByText('Continuar'))
    fireEvent.click(screen.getByText('Sí, cerrar mesa'))
    expect(onSelect).toHaveBeenCalledWith('tarjeta', { propinaEfectivo: 0, propinaTarjeta: 0 })
  })

  it('"No, volver" en la confirmación regresa al paso de propina sin llamar onSelect', () => {
    const onSelect = vi.fn()
    render(<MetodoPagoModal total={165} onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Todo en tarjeta'))
    fireEvent.click(screen.getByText('Continuar'))
    expect(screen.getByText(/con tarjeta/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('← No, volver'))
    expect(screen.getByRole('heading', { name: 'Propina' })).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('avisa que el pago por Tali no hace falta registrarlo, con "Tali" resaltado', () => {
    render(<MetodoPagoModal total={165} onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText((_, el) => el.tagName === 'P' && el.textContent.includes('pagó con Tali'))).toBeInTheDocument()
    expect(screen.getByText('Tali').tagName).toBe('STRONG')
  })

  it('"Ambos" pide el desglose y no deja continuar si no cuadra con el total', () => {
    const onSelect = vi.fn()
    render(<MetodoPagoModal total={165} onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Ambos (efectivo + tarjeta)'))

    fireEvent.change(screen.getByLabelText('Cantidad pagada en efectivo'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Cantidad pagada con tarjeta'), { target: { value: '50' } })
    const continuar = screen.getByText('Continuar')
    expect(continuar).toBeDisabled()
    expect(screen.getByText(/Falta \$15\.00/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Cantidad pagada con tarjeta'), { target: { value: '65' } })
    expect(continuar).not.toBeDisabled()
  })

  it('en "Ambos", el campo vacío sugiere en el placeholder lo que falta del total', () => {
    render(<MetodoPagoModal total={100} onSelect={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Ambos (efectivo + tarjeta)'))

    const inputEfectivo = screen.getByLabelText('Cantidad pagada en efectivo')
    const inputTarjeta = screen.getByLabelText('Cantidad pagada con tarjeta')
    expect(inputEfectivo).toHaveAttribute('placeholder', '$0.00')
    expect(inputTarjeta).toHaveAttribute('placeholder', '$0.00')

    fireEvent.change(inputEfectivo, { target: { value: '40' } })
    expect(inputTarjeta).toHaveAttribute('placeholder', '$60.00')

    fireEvent.change(inputEfectivo, { target: { value: '' } })
    fireEvent.change(inputTarjeta, { target: { value: '20' } })
    expect(inputEfectivo).toHaveAttribute('placeholder', '$80.00')

    // Si ya se pasó del total, no sugiere un número negativo.
    fireEvent.change(inputTarjeta, { target: { value: '150' } })
    expect(inputEfectivo).toHaveAttribute('placeholder', '$0.00')
  })

  it('"Ambos" pide propina de efectivo y tarjeta por separado y las manda por separado', () => {
    const onSelect = vi.fn()
    render(<MetodoPagoModal total={165} onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Ambos (efectivo + tarjeta)'))
    fireEvent.change(screen.getByLabelText('Cantidad pagada en efectivo'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Cantidad pagada con tarjeta'), { target: { value: '65' } })
    fireEvent.click(screen.getByText('Continuar'))

    expect(screen.getByText('Propina en efectivo')).toBeInTheDocument()
    expect(screen.getByText('Propina con tarjeta')).toBeInTheDocument()

    // El default es por porcentaje; se cambia cada campo a monto fijo.
    const [cantidadEf, cantidadTar] = screen.getAllByText('Cantidad')
    fireEvent.click(cantidadEf)
    fireEvent.click(cantidadTar)
    fireEvent.change(screen.getByLabelText('Propina en efectivo'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Propina con tarjeta'), { target: { value: '5' } })
    fireEvent.click(screen.getByText('Continuar'))

    expect(screen.getByText('Confirmación')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Sí, cerrar mesa'))
    expect(onSelect).toHaveBeenCalledWith('ambos', { efectivo: 100, tarjeta: 65, propinaEfectivo: 10, propinaTarjeta: 5 })
  })

  it('la propina por porcentaje (default) se calcula sobre lo pagado en ese método', () => {
    const onSelect = vi.fn()
    render(<MetodoPagoModal total={200} onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Todo en efectivo'))
    fireEvent.click(screen.getByText('15%'))
    fireEvent.click(screen.getByText('Continuar'))
    expect(screen.getByText('Propina (15%)')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Sí, cerrar mesa'))
    expect(onSelect).toHaveBeenCalledWith('efectivo', { propinaEfectivo: 30, propinaTarjeta: 0 })
  })
})
