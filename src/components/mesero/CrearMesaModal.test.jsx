import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrearMesaModal } from './CrearMesaModal'
import { MESEROS } from '../../lib/mockMeseros'

const [ROSA, BETO] = MESEROS

function abrir() {
  const onConfirm = vi.fn().mockResolvedValue({ error: null })
  render(<CrearMesaModal meseros={MESEROS} onConfirm={onConfirm} onClose={() => {}} />)
  return onConfirm
}

describe('CrearMesaModal — a quién se le asigna la mesa nueva', () => {
  it('deja elegir VARIOS meseros y los manda todos', async () => {
    const onConfirm = abrir()
    await userEvent.type(screen.getByPlaceholderText(/^Ej. 16/), '16')
    await userEvent.click(screen.getByText(ROSA.nombre))
    await userEvent.click(screen.getByText(BETO.nombre))
    await userEvent.click(screen.getByText('Crear mesa'))
    expect(onConfirm).toHaveBeenCalledWith('16', [ROSA.id, BETO.id])
  })

  it('se puede crear sin nadie: la mesa queda a nombre del primero que le mande una orden', async () => {
    const onConfirm = abrir()
    expect(screen.getByText(/quedará a nombre del primero/i)).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText(/^Ej. 16/), '16')
    await userEvent.click(screen.getByText('Crear mesa'))
    expect(onConfirm).toHaveBeenCalledWith('16', [])
  })
})
