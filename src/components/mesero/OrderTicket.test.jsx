import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderTicket } from './OrderTicket'
import { buildDraftItem } from '../../hooks/useOrderDraft'
import { MENU } from '../../test/fixtures/menu'
import { MESEROS } from '../../test/fixtures/meseros'
import { useMeseroStore, usePosStore } from '../../store/appStore'

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
      onCancelarEnviado={noop}
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

describe('OrderTicket — cancelar un platillo ya enviado', () => {
  // Un renglón ya enviado de 3 piezas que cocina ya está preparando.
  function enviado(onCancelarEnviado) {
    const item = { ...buildDraftItem(sope, 0), cantidad: 3, nombre: 'Sope', precio_unitario: 110 }
    usePosStore.setState({ meseros: MESEROS })
    useMeseroStore.setState({ currentMeseroId: 'mesero-2' }) // un mesero que NO es admin
    return ticket({
      draft: [],
      cuenta: { items: [{ id: 'ci-1', nombre: 'Sope', precio_unitario: 110, cantidad: 3 }] },
      pedidos: [{ id: 'p-1', estado: 'preparando', items: [item] }],
      onCancelarEnviado,
    })
  }

  it('se puede aunque cocina ya lo esté preparando, pero solo con el PIN de un admin', () => {
    const onCancelarEnviado = vi.fn()
    enviado(onCancelarEnviado)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar menos' })) // 2 de 3
    fireEvent.click(screen.getByRole('button', { name: 'Pedir autorización' }))

    // Hay un solo admin en los fixtures: va directo a su PIN. Uno equivocado no pasa.
    for (const d of '2222') fireEvent.click(screen.getByRole('button', { name: d }))
    expect(screen.getByText('PIN incorrecto, inténtalo de nuevo')).toBeInTheDocument()
    expect(onCancelarEnviado).not.toHaveBeenCalled()

    for (const d of '1111') fireEvent.click(screen.getByRole('button', { name: d }))
    expect(onCancelarEnviado).toHaveBeenCalledWith('p-1', expect.any(String), 2, 'mesero-1')
  })
})

describe('OrderTicket — sumar piezas a un platillo que está en dos comandas', () => {
  it('fija el renglón de la comanda en Nuevo con solo lo que se sumó', () => {
    // 2 sopes en una comanda que cocina ya está preparando + 1 en otra que sigue en Nuevo:
    // la cuenta los junta en una fila de 3, pero el + solo puede tocar la de Nuevo.
    const sope1 = { ...buildDraftItem(sope, 0), cantidad: 2, nombre: 'Sope', precio_unitario: 110 }
    const sope2 = { ...buildDraftItem(sope, 0), cantidad: 1, nombre: 'Sope', precio_unitario: 110 }
    const onFijarEnviado = vi.fn()
    ticket({
      draft: [],
      cuenta: { items: [{ id: 'ci-1', nombre: 'Sope', precio_unitario: 110, cantidad: 3 }] },
      pedidos: [
        { id: 'p-viejo', estado: 'preparando', items: [sope1] },
        { id: 'p-nuevo', estado: 'pendiente', items: [sope2] },
      ],
      subtotalCuenta: 330,
      onFijarEnviado,
    })

    fireEvent.click(screen.getByRole('button', { name: '+' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar cambios a cocina' }))

    expect(onFijarEnviado).toHaveBeenCalledTimes(1)
    expect(onFijarEnviado).toHaveBeenCalledWith('p-nuevo', sope2.id, 2)
  })
})
