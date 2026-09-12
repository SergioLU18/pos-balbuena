import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminMeserosPage from './AdminMeserosPage'
import { usePosStore, useMeseroStore } from '../../store/appStore'
import { MESAS } from '../../lib/mockMesas'
import { MESEROS, ASIGNACIONES } from '../../lib/mockMeseros'

const [ROSA] = MESEROS

beforeEach(() => {
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS, asignaciones: ASIGNACIONES })
  useMeseroStore.setState({ currentMeseroId: ROSA.id })
})

describe('AdminMeserosPage — reparto del salón', () => {
  it('ya no lista las mesas ni el PIN en la tarjeta de cada mesero', () => {
    render(<AdminMeserosPage />)
    expect(screen.queryByText(/^Mesas:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^PIN:/)).not.toBeInTheDocument()
  })

  it('cuenta las mesas compartidas en el encabezado', () => {
    render(<AdminMeserosPage />)
    expect(screen.getByText(/1 mesa compartida/)).toBeInTheDocument()
  })

  it('al crear o editar ya no se piden las mesas que atiende', async () => {
    render(<AdminMeserosPage />)
    await userEvent.click(screen.getAllByText('Editar')[0])
    expect(screen.queryByText('Mesas que atiende')).not.toBeInTheDocument()
  })
})
