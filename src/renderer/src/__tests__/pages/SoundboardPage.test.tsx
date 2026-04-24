import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const useSoundboard = vi.fn()

vi.mock('@renderer/hooks/useSoundboard', () => ({
  useSoundboard: (...args: unknown[]) => useSoundboard(...args)
}))
vi.mock('@renderer/components/SoundboardGrid/SoundboardGrid', () => ({
  default: ({ onAssign, onTrigger }: { onAssign: (slot: number) => void; onTrigger: (slot: number) => void }) => (
    <div data-testid="sb-grid">
      <button onClick={() => onAssign(3)}>Assign slot 3</button>
      <button onClick={() => onTrigger(5)}>Trigger slot 5</button>
    </div>
  )
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
    vi.clearAllMocks()
    useSoundboard.mockReturnValue({ ...baseHook })

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: {
        audioAssets: {
          pickFiles: vi.fn().mockResolvedValue(['C:/jingle.mp3']),
          importBatch: vi.fn().mockResolvedValue([{ id: 'a-1', name: 'Jingle' }])
        }
      }
    })
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

  it('asigna audio en un slot cuando hay archivo seleccionado', async () => {
    const assign = vi.fn().mockResolvedValue(undefined)
    useSoundboard.mockReturnValue({ ...baseHook, assign })

    render(<SoundboardPage profileId="p1" />)
    fireEvent.click(screen.getByText('Assign slot 3'))

    await waitFor(() => expect(assign).toHaveBeenCalledWith(3, { audioAssetId: 'a-1', label: 'Jingle' }))
  })

  it('limpia estado de asignación cuando el usuario cancela picker', async () => {
    ;(window.electronAPI.audioAssets.pickFiles as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])
    const assign = vi.fn().mockResolvedValue(undefined)
    useSoundboard.mockReturnValue({ ...baseHook, assign })

    render(<SoundboardPage profileId="p1" />)
    fireEvent.click(screen.getByText('Assign slot 3'))

    await waitFor(() => expect(assign).not.toHaveBeenCalled())
  })

  it('delegates trigger callback al grid', () => {
    const trigger = vi.fn()
    useSoundboard.mockReturnValue({ ...baseHook, trigger })

    render(<SoundboardPage profileId="p1" />)
    fireEvent.click(screen.getByText('Trigger slot 5'))
    expect(trigger).toHaveBeenCalledWith(5)
  })
})
