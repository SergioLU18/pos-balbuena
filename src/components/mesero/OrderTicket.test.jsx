import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderTicket } from './OrderTicket'
import { buildDraftItem } from '../../hooks/useOrderDraft'
import { MENU } from '../../lib/mockMenu'

const sope = MENU.find((p) => p.id === 'sope')

function ticket(props) {
  const noop = () => {}
  return render(
    <OrderTicket
      draft={[buildDraftItem(sope, 0)]}
      cuenta={{ items: [] }}
      pedidos={[]}
      subtotalDraft={110}
      subtotalCuenta={0}
      onQty={noop}
      onRemove={noop}
      onFijarEnviado={noop}
      onRemoveEnviado={noop}
      onEnviar={noop}
      {...props}
    />,
  )
}

describe('OrderTicket — enviar a cocina', () => {
  it('manda el draft al tocar el botón', () => {
    const onEnviar = vi.fn()
    ticket({ onEnviar })
    fireEvent.click(screen.getByRole('button', { name: /a cocina/ }))
    expect(onEnviar).toHaveBeenCalledTimes(1)
  })

  it('mientras el envío está en vuelo el botón se apaga: un doble toque no duplica la comanda', () => {
    const onEnviar = vi.fn()
    ticket({ onEnviar, enviando: true })
    const boton = screen.getByRole('button', { name: 'Enviando…' })
    expect(boton).toBeDisabled()
    fireEvent.click(boton)
    expect(onEnviar).not.toHaveBeenCalled()
  })
})
