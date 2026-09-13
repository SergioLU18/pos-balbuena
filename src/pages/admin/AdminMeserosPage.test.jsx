import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminMeserosPage from './AdminMeserosPage'
import { usePosStore, useMeseroStore } from '../../store/appStore'
import { MESAS } from '../../lib/mockMesas'
import { MESEROS } from '../../lib/mockMeseros'

const [ROSA] = MESEROS

beforeEach(() => {
  usePosStore.setState({ mesas: MESAS, meseros: MESEROS })
  useMeseroStore.setState({ currentMeseroId: ROSA.id })
})

describe('AdminMeserosPage — sin reparto de mesas', () => {
  it('la tarjeta del mesero no habla de mesas', () => {
    render(<AdminMeserosPage />)
    expect(screen.getByText(ROSA.nombre)).toBeInTheDocument()
    expect(screen.queryByText(/Mesas:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/mesas asignadas/)).not.toBeInTheDocument()
  })

  it('al editar ya no pide las mesas que atiende', async () => {
    render(<AdminMeserosPage />)
    await userEvent.click(screen.getAllByText('Editar')[0])
    expect(screen.getByText(`Editar ${ROSA.nombre}`)).toBeInTheDocument()
    expect(screen.queryByText('Mesas que atiende')).not.toBeInTheDocument()
  })
})
