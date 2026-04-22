import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NowPlayingBar from '@renderer/components/NowPlayingBar/NowPlayingBar'
import type { PlayoutStatus } from '@renderer/types/ipc.types'

function buildStatus(state: PlayoutStatus['state']): PlayoutStatus {
  return {
    state,
    profileId: 'p1',
    track: state === 'stopped' ? null : {
      id: 'a1',
      name: 'Track 1',
      sourceType: 'local',
      sourcePath: '/tmp/a.mp3',
      durationMs: 120000,
      tags: '{}',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    queueIndex: 0,
    queueLength: 4,
    songsSinceLastAd: 0
  }
}

describe('NowPlayingBar', () => {
  it('renders stopped state and disabled transport', () => {
    const controls = { pause: vi.fn(), resume: vi.fn(), next: vi.fn(), stop: vi.fn() }
    render(<NowPlayingBar status={buildStatus('stopped')} controls={controls} />)

    expect(screen.getByText('Detenido')).toBeInTheDocument()
    expect(screen.getByText('— Sin reproducción —')).toBeInTheDocument()
    expect(screen.getByTitle('Siguiente')).toBeDisabled()
    expect(screen.getByTitle('Detener')).toBeDisabled()
  })

  it('renders playing state and triggers pause', () => {
    const controls = { pause: vi.fn(), resume: vi.fn(), next: vi.fn(), stop: vi.fn() }
    render(<NowPlayingBar status={buildStatus('playing')} controls={controls} />)

    expect(screen.getByText('En aire')).toBeInTheDocument()
    expect(screen.getByText('Track 1')).toBeInTheDocument()
    expect(screen.getByText('1 / 4')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Pausar'))
    expect(controls.pause).toHaveBeenCalledTimes(1)
  })

  it('shows resume button in paused state', () => {
    const controls = { pause: vi.fn(), resume: vi.fn(), next: vi.fn(), stop: vi.fn() }
    render(<NowPlayingBar status={buildStatus('paused')} controls={controls} />)

    fireEvent.click(screen.getByTitle('Reanudar'))
    expect(controls.resume).toHaveBeenCalledTimes(1)
  })

  it('renders ad break state and pause control', () => {
    const controls = { pause: vi.fn(), resume: vi.fn(), next: vi.fn(), stop: vi.fn() }
    render(<NowPlayingBar status={buildStatus('ad_break')} controls={controls} />)

    expect(screen.getByText('Tanda')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Pausar'))
    expect(controls.pause).toHaveBeenCalledTimes(1)
  })
})
