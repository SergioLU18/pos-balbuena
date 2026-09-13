import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrearMesaModal } from './CrearMesaModal'

function abrir() {
  const onConfirm = vi.fn().mockResolvedValue({ error: null })
  render(<CrearMesaModal onConfirm={onConfirm} onClose={() => {}} />)
  return onConfirm
}

describe('CrearMesaModal', () => {
  it('crea la mesa con el nombre escrito', async () => {
    const onConfirm = abrir()
    await userEvent.type(screen.getByPlaceholderText(/^Ej. 16/), '16')
    await userEvent.click(screen.getByText('Crear mesa'))
    expect(onConfirm).toHaveBeenCalledWith('16')
  })

  it('no pregunta quién la atiende: cualquier mesero atiende cualquier mesa', () => {
    abrir()
    expect(screen.queryByText(/quién la atiende/i)).not.toBeInTheDocument()
  })
})
