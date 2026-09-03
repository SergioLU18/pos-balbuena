import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminMeserosPage from './AdminMeserosPage'
import { usePosStore, useMeseroStore } from '../../store/appStore'
import { MESAS } from '../../lib/mockMesas'
import { MESEROS, ASIGNACIONES } from '../../lib/mockMeseros'

const [ROSA, BETO] = MESEROS

beforeEach(() => {
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS, asignaciones: ASIGNACIONES })
  useMeseroStore.setState({ currentMeseroId: ROSA.id })
})

describe('AdminMeserosPage — reparto del salón', () => {
  it('lista las mesas de cada mesero desde las asignaciones', () => {
    render(<AdminMeserosPage />)
    expect(screen.getByText('Mesas: 1, 2, 3, 4, 5')).toBeInTheDocument()
    expect(screen.getByText('Mesas: 5, 6, 7, 8, 9, 10')).toBeInTheDocument()
  })

  it('dice con quién se comparte cada mesa traslapada', () => {
    render(<AdminMeserosPage />)
    expect(screen.getByText(`Comparte 5 (${BETO.nombre})`)).toBeInTheDocument()
    expect(screen.getByText(`Comparte 5 (${ROSA.nombre})`)).toBeInTheDocument()
  })

  it('cuenta las mesas compartidas en el encabezado', () => {
    render(<AdminMeserosPage />)
    expect(screen.getByText(/1 mesa compartida/)).toBeInTheDocument()
  })

  it('al editar, avisa que marcar una mesa no se la quita a nadie', async () => {
    render(<AdminMeserosPage />)
    await userEvent.click(screen.getAllByText('Editar')[0])
    expect(screen.getByText('Mesas que atiende')).toBeInTheDocument()
    expect(screen.getByText(/no se la quita a nadie/)).toBeInTheDocument()
    // Cada chip dice quién MÁS atiende esa mesa: la 5 la comparte con Beto, la 1 no
    // la atiende nadie más. Así marcar una mesa no se siente como quitársela a otro.
    const chip = (numero) => screen.getByText(numero, { selector: 'span' }).closest('button')
    expect(chip('5').textContent).toContain(`con ${BETO.nombre}`)
    expect(chip('1').textContent).toBe('1')
  })
})
