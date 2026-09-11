import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfigurarPlatilloModal } from './ConfigurarPlatilloModal'
import { useMenu } from '../../hooks/useMenu'
import { MENU } from '../../lib/mockMenu'
import { f } from '../../lib/utils'

// Render helper con los catálogos globales (como los pasa MeseroOrdenPage vía useMenu).
function renderModal(platillo, onConfirm = () => {}) {
  let props
  function Harness() {
    const { ingredientes, modificadores, extras } = useMenu()
    props = { ingredientes, modificadores, extras }
    return (
      <ConfigurarPlatilloModal
        platillo={platillo}
        ingredientes={ingredientes}
        modificadores={modificadores}
        extras={extras}
        onConfirm={onConfirm}
        onClose={() => {}}
      />
    )
  }
  render(<Harness />)
  return props
}

const dish = (id) => MENU.find((p) => p.id === id)

describe('ConfigurarPlatilloModal — allowlists por platillo', () => {
  it('una bebida no muestra Personaliza ni extras de catálogo (no le corresponden)', () => {
    renderModal(dish('bebida'))
    expect(screen.queryByText('Personaliza')).toBeNull()
    // Ninguno de los extras de comida debe aparecer
    expect(screen.queryByText('Crema')).toBeNull()
    expect(screen.queryByText('Chile Habanero')).toBeNull()
  })

  it('una quesadilla muestra solo sus 2 modificadores, no los de otros platillos', () => {
    renderModal(dish('quesadilla'))
    expect(screen.getByText('Personaliza')).toBeTruthy()
    expect(screen.getByText('Sin Crema')).toBeTruthy()
    expect(screen.getByText('Sin Salsa Verde')).toBeTruthy()
    // La quesadilla no tiene frijol/lechuga que quitar
    expect(screen.queryByText('Sin Frijol')).toBeNull()
    expect(screen.queryByText('Sin Lechuga (Romanita)')).toBeNull()
    // Sí ofrece los extras de comida
    expect(screen.getByText('Extras')).toBeTruthy()
  })
})

describe('ConfigurarPlatilloModal — extra libre', () => {
  // El caso que motiva la función: el cliente pide algo que nadie va a dar de alta en el
  // catálogo ("un huevo"), y el mesero tiene que poder cobrarlo sin salir de la orden.
  it('el campo abierto está en TODOS los platillos, incluso donde no hay extras de catálogo', () => {
    renderModal(dish('bebida'))
    expect(screen.getByText('Extras')).toBeTruthy()
    expect(screen.getByLabelText('Otro extra')).toBeTruthy()
    expect(screen.getByLabelText('Precio del extra')).toBeTruthy()
  })

  it('agrega el extra escrito al renglón, con su precio sumado al total', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderModal(dish('bebida'), onConfirm)

    await user.type(screen.getByLabelText('Otro extra'), 'Un huevo')
    await user.type(screen.getByLabelText('Precio del extra'), '15')
    await user.click(screen.getByRole('button', { name: 'Agregar' }))

    // Queda como chip quitable y el botón de confirmar ya trae el total con el extra.
    expect(screen.getByText('Un huevo ✕')).toBeTruthy()
    // El refresco define sus precios por variante de sabor (como las tortillas).
    const total = dish('bebida').tortillas[0].tiers[0].precio + 15
    await user.click(screen.getByRole('button', { name: `Agregar · ${f(total)}` }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm.mock.calls[0][0].extras).toEqual([{ nombre: 'Un huevo', precio: 15, libre: true }])
  })

  it('no deja agregar sin nombre ni sin precio escrito (un extra gratis por descuido no se nota hasta la cuenta)', async () => {
    const user = userEvent.setup()
    renderModal(dish('bebida'))
    const agregar = screen.getByRole('button', { name: 'Agregar' })

    expect(agregar.disabled).toBe(true)
    await user.type(screen.getByLabelText('Otro extra'), 'Un huevo')
    expect(agregar.disabled).toBe(true) // falta el precio: en blanco NO vale $0
    await user.type(screen.getByLabelText('Precio del extra'), '0')
    expect(agregar.disabled).toBe(false) // $0 explícito sí vale
  })

  it('quita un extra libre al tocar su chip, sin tocar los otros del mismo nombre', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderModal(dish('sope'), onConfirm)

    const nombre = screen.getByLabelText('Otro extra')
    const precio = screen.getByLabelText('Precio del extra')
    for (const p of ['15', '20']) {
      await user.type(nombre, 'Huevo')
      await user.type(precio, p)
      await user.click(screen.getByRole('button', { name: 'Agregar' }))
    }
    expect(screen.getAllByText('Huevo ✕')).toHaveLength(2)

    await user.click(screen.getAllByText('Huevo ✕')[0])
    await user.click(screen.getByRole('button', { name: /^Agregar · / }))
    expect(onConfirm.mock.calls[0][0].extras).toEqual([{ nombre: 'Huevo', precio: 20, libre: true }])
  })
})

describe('mockMenu — integridad de las allowlists', () => {
  it('cada platillo referencia modificadores/extras que existen en el catálogo global', () => {
    const { modificadores, extras } = renderModal(dish('sope')) // props traen catálogos
    const modSet = new Set(modificadores)
    const extraSet = new Set(extras.map((e) => e.nombre))
    for (const p of MENU) {
      for (const m of p.modificadores ?? []) expect(modSet.has(m)).toBe(true)
      for (const e of p.extras ?? []) expect(extraSet.has(e)).toBe(true)
    }
  })
})
