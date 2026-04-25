import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const usePrograms = vi.fn()
const usePlaylists = vi.fn()

vi.mock('@renderer/hooks/usePrograms', () => ({
  usePrograms: (...args: unknown[]) => usePrograms(...args)
}))
vi.mock('@renderer/hooks/usePlaylists', () => ({
  usePlaylists: (...args: unknown[]) => usePlaylists(...args)
}))

import ProgramsPage from '@renderer/pages/ProgramsPage/ProgramsPage'

describe('ProgramsPage', () => {
  const create = vi.fn().mockResolvedValue({})
  const remove = vi.fn()

  beforeEach(() => {
    usePrograms.mockReturnValue({
      programs: [{ id: 'g1', name: 'Mañana', dayOfWeek: 1, startTime: '08:00', endTime: '10:00' }],
      create,
      remove
    })
    usePlaylists.mockReturnValue({ playlists: [{ id: 'pl1', name: 'Lista A' }] })
  })

  it('renders title and weekly grid', () => {
    render(<ProgramsPage profileId="p1" />)
    expect(screen.getByText('Grilla Semanal')).toBeInTheDocument()
    expect(screen.getByText('Mañana')).toBeInTheDocument()
  })

  it('opens modal when clicking + Agregar', () => {
    render(<ProgramsPage profileId="p1" />)
    fireEvent.click(screen.getAllByText('+ Agregar')[0])
    expect(screen.getByText(/Nuevo programa/)).toBeInTheDocument()
  })

  it('shows error when submitting without name', async () => {
    render(<ProgramsPage profileId="p1" />)
    fireEvent.click(screen.getAllByText('+ Agregar')[0])
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() => expect(screen.getByText('El nombre es requerido')).toBeInTheDocument())
    expect(create).not.toHaveBeenCalled()
  })

  it('calls create with form values', async () => {
    render(<ProgramsPage profileId="p1" />)
    fireEvent.click(screen.getAllByText('+ Agregar')[0])
    const nameInput = screen.getAllByRole('textbox')[0] as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Tarde' } })
    fireEvent.click(screen.getByText('Crear'))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Tarde', startTime: '08:00', endTime: '09:00' })
      )
    )
  })

  it('calls remove when clicking Eliminar on program', () => {
    render(<ProgramsPage profileId="p1" />)
    fireEvent.click(screen.getByText('Eliminar'))
    expect(remove).toHaveBeenCalledWith('g1')
  })
})
