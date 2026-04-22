import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from '@renderer/components/Sidebar/Sidebar'

describe('Sidebar', () => {
  it('renders all navigation items', () => {
    render(
      <MemoryRouter>
        <Sidebar activeProfile={null} />
      </MemoryRouter>
    )

    expect(screen.getByText('Playout')).toBeInTheDocument()
    expect(screen.getByText('Playlists')).toBeInTheDocument()
    expect(screen.getByText('Soundboard')).toBeInTheDocument()
    expect(screen.getByText('Tandas')).toBeInTheDocument()
    expect(screen.getByText('Programas')).toBeInTheDocument()
    expect(screen.getByText('Salidas')).toBeInTheDocument()
    expect(screen.getByText('Perfiles')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows active profile name', () => {
    render(
      <MemoryRouter>
        <Sidebar activeProfile={{ id: 'p1', name: 'Studio', isDefault: true, preferences: '{}', createdAt: '', updatedAt: '' }} />
      </MemoryRouter>
    )

    expect(screen.getByText('Studio')).toBeInTheDocument()
  })

  it('marks current route as active', () => {
    render(
      <MemoryRouter initialEntries={['/playout']}>
        <Sidebar activeProfile={null} />
      </MemoryRouter>
    )

    const playoutLink = screen.getByText('Playout').closest('a')
    expect(playoutLink?.className).toContain('active')
  })
})
