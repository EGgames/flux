import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Howl } from 'howler'
import { usePlayout } from '@renderer/hooks/usePlayout'
import { playoutService } from '@renderer/services/playoutService'
import { outputService } from '@renderer/services/outputService'

vi.mock('howler', () => ({
  Howl: vi.fn(),
  Howler: { ctx: null, masterGain: null }
}))

vi.mock('@renderer/services/playoutService', () => ({
  playoutService: {
    start: vi.fn(),
    syncProgram: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    next: vi.fn(),
    getStatus: vi.fn(),
    triggerAdBlock: vi.fn(),
    streamChunk: vi.fn()
  }
}))

vi.mock('@renderer/services/outputService', () => ({
  outputService: {
    list: vi.fn().mockResolvedValue([])
  }
}))

const mocked = vi.mocked(playoutService)
const mockedOutput = vi.mocked(outputService)

const defaultHowlInstance = {
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  unload: vi.fn(),
  seek: vi.fn((pos?: number) => pos ?? 0),
  duration: vi.fn(() => 0),
  playing: vi.fn(() => false),
  fade: vi.fn()
}

describe('usePlayout', () => {
  const callbacks: Record<string, (...args: unknown[]) => void> = {}
  const on = vi.fn((channel: string, cb: (...args: unknown[]) => void) => { callbacks[channel] = cb })
  const off = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockedOutput.list.mockResolvedValue([])
    Object.keys(callbacks).forEach((k) => delete callbacks[k])

    vi.mocked(Howl).mockImplementation(() => defaultHowlInstance as unknown as Howl)

    Object.defineProperty(window, 'electronAPI', {
      value: {
        on,
        off,
        playout: {
          next: vi.fn()
        }
      },
      writable: true,
      configurable: true
    })
  })

  it('subscribes and unsubscribes ipc events', () => {
    const { unmount } = renderHook(() => usePlayout())

    expect(on).toHaveBeenCalledTimes(4)
    unmount()
    expect(off).toHaveBeenCalledTimes(4)
  })

  it('updates state on state/ad events', async () => {
    const { result } = renderHook(() => usePlayout())

    act(() => {
      callbacks['playout:state-changed']?.({ state: 'playing' })
    })
    expect(result.current.status.state).toBe('playing')

    act(() => {
      callbacks['playout:ad-start']?.({ block: { id: 'b1', name: 'B1' } })
    })
    expect(result.current.status.state).toBe('ad_break')
  })

  it('plays track and handles onend/onloaderror', async () => {
    const { result } = renderHook(() => usePlayout())
    const track = {
      id: 'a1',
      name: 'Track',
      sourceType: 'local',
      sourcePath: 'C:\\music\\song.mp3',
      durationMs: null,
      tags: '{}',
      createdAt: '',
      updatedAt: ''
    }

    act(() => {
      callbacks['playout:track-changed']?.({ track })
    })

    expect(result.current.status.track?.id).toBe('a1')
    expect(defaultHowlInstance.play).toHaveBeenCalled()

    const opts = vi.mocked(Howl).mock.calls.at(-1)?.[0] as Record<string, unknown>

    act(() => {
      ;(opts.onend as () => void)?.() 
    })
    expect(window.electronAPI.playout.next).toHaveBeenCalledTimes(1)

    act(() => {
      ;(opts.onloaderror as (id: number, err: unknown) => void)?.(0, 'err')
    })
    await waitFor(() => {
      expect(result.current.error).toContain('No se pudo cargar')
    })
    expect(window.electronAPI.playout.next).toHaveBeenCalledTimes(2)
  })

  it('uses stream source path when sourceType is stream', () => {
    renderHook(() => usePlayout())
    const track = {
      id: 'a2',
      name: 'Stream',
      sourceType: 'stream',
      sourcePath: 'https://example.com/live.mp3',
      durationMs: null,
      tags: '{}',
      createdAt: '',
      updatedAt: ''
    }

    act(() => {
      callbacks['playout:track-changed']?.({ track })
    })

    const opts = vi.mocked(Howl).mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect((opts.src as string[])[0]).toBe('https://example.com/live.mp3')
  })

  it('start handles success and error branches', async () => {
    const { result } = renderHook(() => usePlayout())
    mocked.start.mockResolvedValueOnce({
      state: 'playing',
      profileId: 'p1',
      track: null,
      queueIndex: 0,
      queueLength: 2,
      songsSinceLastAd: 0
    } as never)

    await act(async () => {
      await result.current.start('p1', 'pl1')
    })
    expect(result.current.status.state).toBe('playing')

    mocked.start.mockRejectedValueOnce(new Error('boom'))
    await act(async () => {
      await result.current.start('p1')
    })
    expect(result.current.error).toBe('boom')

    mocked.start.mockRejectedValueOnce('plain-error' as never)
    await act(async () => {
      await result.current.start('p1')
    })
    expect(result.current.error).toBe('Error al iniciar')
  })

  it('transport controls delegate to service and howl', async () => {
    const { result } = renderHook(() => usePlayout())

    const localTrack = {
      id: 'a3',
      name: 'Local',
      sourceType: 'local',
      sourcePath: 'C:\\music\\local.mp3',
      durationMs: null,
      tags: '{}',
      createdAt: '',
      updatedAt: ''
    }
    act(() => {
      callbacks['playout:track-changed']?.({ track: localTrack })
      callbacks['playout:track-changed']?.({ track: localTrack })
    })

    await act(async () => { await result.current.stop() })
    act(() => { result.current.pause() })
    act(() => { result.current.resume() })
    act(() => { result.current.next() })
    await act(async () => { await result.current.triggerAdBlock('ab1') })

    expect(mocked.stop).toHaveBeenCalledTimes(1)
    expect(mocked.pause).toHaveBeenCalledTimes(1)
    expect(mocked.resume).toHaveBeenCalledTimes(1)
    expect(mocked.next).toHaveBeenCalledTimes(1)
    expect(mocked.triggerAdBlock).toHaveBeenCalledWith('ab1')
  })
})
