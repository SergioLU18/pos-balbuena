import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfigurarPlatilloModal } from './ConfigurarPlatilloModal'
import { useMenu } from '../../hooks/useMenu'
import { MENU } from '../../lib/mockMenu'
import { f } from '../../lib/utils'

// Render helper con los catálogos globales (como los pasa MeseroOrdenPage vía useMenu).
function renderModal(platillo, onConfirm = () => {}, extra = {}) {
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
        {...extra}
      />
    )
  }
  render(<Harness />)
  return props
}

const dish = (id) => MENU.find((p) => p.id === id)

describe('ConfigurarPlatilloModal — allowlists por platillo', () => {
  it('una bebida no muestra Modificar ni extras de catálogo (no le corresponden)', () => {
    renderModal(dish('bebida'))
    expect(screen.queryByText('Modificar')).toBeNull()
    // Ninguno de los extras de comida debe aparecer
    expect(screen.queryByText('Crema')).toBeNull()
    expect(screen.queryByText('Chile Habanero')).toBeNull()
  })

  it('una quesadilla muestra solo sus 2 modificadores, no los de otros platillos', () => {
    renderModal(dish('quesadilla'))
    expect(screen.getByText('Modificar')).toBeTruthy()
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
    // Sin catálogo de extras ni ninguno agregado, la sección "Extras" no tiene nada que
    // mostrar y no se renderiza; el control para agregar uno libre vive aparte y siempre
    // está presente, bajo su propio encabezado "Otro extra".
    expect(screen.queryByText('Extras')).toBeNull()
    expect(screen.getByText('Otro extra')).toBeTruthy()
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

describe('ConfigurarPlatilloModal — un platillo de mesa para llevar', () => {
  const refresco = dish('bebida') // $40, sin ingredientes que elegir

  it('solo se ofrece en la mesa (permiteParaLlevar)', () => {
    renderModal(refresco)
    expect(screen.queryByText(/Para llevar/)).toBeNull()
  })

  it('marcado, el renglón sale en desechable y el botón ya cobra los $5', async () => {
    const onConfirm = vi.fn()
    renderModal(refresco, onConfirm, { permiteParaLlevar: true })
    await userEvent.click(screen.getByRole('button', { name: /Para llevar/ }))
    await userEvent.click(screen.getByRole('button', { name: `Agregar · ${f(45)}` }))

    const item = onConfirm.mock.calls[0][0]
    expect(item.empaque).toBe('plastico')
    expect(item.ajusteEmpaque).toBe(5)
  })

  it('desmarcarlo al reeditar le quita el empaque', async () => {
    const onConfirm = vi.fn()
    const itemInicial = { tierIndex: 0, cantidad: 1, empaque: 'plastico', ajusteEmpaque: 5 }
    renderModal(refresco, onConfirm, { permiteParaLlevar: true, itemInicial })
    await userEvent.click(screen.getByRole('button', { name: /Para llevar/ }))
    await userEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))

    expect(onConfirm.mock.calls[0][0].empaque).toBeUndefined()
    expect(onConfirm.mock.calls[0][0].ajusteEmpaque).toBeUndefined()
  })
})
