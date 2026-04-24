import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const useSoundboard = vi.fn()

vi.mock('@renderer/hooks/useSoundboard', () => ({
  useSoundboard: (...args: unknown[]) => useSoundboard(...args)
}))
vi.mock('@renderer/components/SoundboardGrid/SoundboardGrid', () => ({
  default: () => <div data-testid="sb-grid" />
}))

import SoundboardPage from '@renderer/pages/SoundboardPage/SoundboardPage'

const baseHook = {
  buttons: [],
  assign: vi.fn(),
  trigger: vi.fn(),
  stopAll: vi.fn(),
  pauseAll: vi.fn(),
  resumeAll: vi.fn(),
  isPaused: false,
  gridResetKey: 0
}

describe('SoundboardPage', () => {
  beforeEach(() => {
    useSoundboard.mockReturnValue({ ...baseHook })
  })

  it('renders the grid component', () => {
    render(<SoundboardPage profileId="p1" />)
    expect(screen.getByTestId('sb-grid')).toBeInTheDocument()
  })

  it('shows ⏸ Pausar when not paused', () => {
    render(<SoundboardPage profileId="p1" />)
    expect(screen.getByText('⏸ Pausar')).toBeInTheDocument()
    expect(screen.queryByText('▶ Reanudar')).not.toBeInTheDocument()
  })

  it('shows ▶ Reanudar when paused', () => {
    useSoundboard.mockReturnValue({ ...baseHook, isPaused: true })
    render(<SoundboardPage profileId="p1" />)
    expect(screen.getByText('▶ Reanudar')).toBeInTheDocument()
    expect(screen.queryByText('⏸ Pausar')).not.toBeInTheDocument()
  })

  it('calls stopAll when clicking Detener', () => {
    const stopAll = vi.fn()
    useSoundboard.mockReturnValue({ ...baseHook, stopAll })
    render(<SoundboardPage profileId="p1" />)
    fireEvent.click(screen.getByTitle('Detener todo'))
    expect(stopAll).toHaveBeenCalled()
  })

  it('calls pauseAll when clicking ⏸ Pausar', () => {
    const pauseAll = vi.fn()
    useSoundboard.mockReturnValue({ ...baseHook, pauseAll })
    render(<SoundboardPage profileId="p1" />)
    fireEvent.click(screen.getByText('⏸ Pausar'))
    expect(pauseAll).toHaveBeenCalled()
  })

  it('calls resumeAll when clicking ▶ Reanudar', () => {
    const resumeAll = vi.fn()
    useSoundboard.mockReturnValue({ ...baseHook, isPaused: true, resumeAll })
    render(<SoundboardPage profileId="p1" />)
    fireEvent.click(screen.getByText('▶ Reanudar'))
    expect(resumeAll).toHaveBeenCalled()
  })
})
