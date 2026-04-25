import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ProfilesPage from '@renderer/pages/ProfilesPage/ProfilesPage'

const baseProfile = {
  id: 'p1',
  name: 'Default',
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  preferences: ''
}

function buildProfilesProp(overrides: Partial<Parameters<typeof ProfilesPage>[0]['profiles']> = {}) {
  return {
    profiles: [baseProfile],
    activeProfile: baseProfile,
    create: vi.fn(),
    select: vi.fn(),
    remove: vi.fn(),
    ...overrides
  } as unknown as Parameters<typeof ProfilesPage>[0]['profiles']
}

describe('ProfilesPage', () => {
  it('renders title and existing profiles', () => {
    render(<ProfilesPage profiles={buildProfilesProp()} />)
    expect(screen.getByText('Perfiles')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('does not show Eliminar/Seleccionar for default profile', () => {
    render(<ProfilesPage profiles={buildProfilesProp()} />)
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument()
    expect(screen.queryByText('Seleccionar')).not.toBeInTheDocument()
  })

  it('shows Eliminar/Seleccionar for non-default profiles', () => {
    const second = { ...baseProfile, id: 'p2', name: 'Other', isDefault: false }
    render(<ProfilesPage profiles={buildProfilesProp({ profiles: [baseProfile, second] })} />)
    expect(screen.getByText('Eliminar')).toBeInTheDocument()
    expect(screen.getByText('Seleccionar')).toBeInTheDocument()
  })

  it('calls create when clicking + Crear with non-empty name', async () => {
    const create = vi.fn().mockResolvedValue({})
    render(<ProfilesPage profiles={buildProfilesProp({ create })} />)

    const input = screen.getByPlaceholderText('Nombre del nuevo perfil...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'New' } })
    fireEvent.click(screen.getByText('+ Crear'))

    await waitFor(() => expect(create).toHaveBeenCalledWith('New'))
  })

  it('does not call create with empty name', () => {
    const create = vi.fn()
    render(<ProfilesPage profiles={buildProfilesProp({ create })} />)
    fireEvent.click(screen.getByText('+ Crear'))
    expect(create).not.toHaveBeenCalled()
  })

  it('shows error message when create throws', async () => {
    const create = vi.fn().mockRejectedValue(new Error('Nombre duplicado'))
    render(<ProfilesPage profiles={buildProfilesProp({ create })} />)

    const input = screen.getByPlaceholderText('Nombre del nuevo perfil...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Dup' } })
    fireEvent.click(screen.getByText('+ Crear'))

    await waitFor(() => expect(screen.getByText('Nombre duplicado')).toBeInTheDocument())
  })

  it('shows "Sin perfiles" when list is empty', () => {
    render(<ProfilesPage profiles={buildProfilesProp({ profiles: [] })} />)
    expect(screen.getByText('Sin perfiles')).toBeInTheDocument()
  })
})
