import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Howl } from 'howler'
import { usePlayout } from '@renderer/hooks/usePlayout'
import { audioEffectsService } from '@renderer/services/audioEffectsService'
import { playoutService } from '@renderer/services/playoutService'

vi.mock('howler', () => ({
  Howl: vi.fn(),
  Howler: { ctx: null, masterGain: null, volume: vi.fn() }
}))

vi.mock('@renderer/services/playoutService', () => ({
  playoutService: {
    start: vi.fn(),
    syncProgram: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    next: vi.fn(),
    getStatus: vi.fn().mockResolvedValue({
      state: 'idle',
      track: null,
      queueIndex: 0,
      queueLength: 0,
      songsSinceLastAd: 0
    }),
    triggerAdBlock: vi.fn(),
    streamChunk: vi.fn()
  }
}))

vi.mock('@renderer/services/outputService', () => ({
  outputService: { list: vi.fn().mockResolvedValue([]) }
}))

vi.mock('@renderer/services/audioEffectsService', () => ({
  audioEffectsService: {
    get: vi.fn(),
    update: vi.fn(),
    updateAssetFades: vi.fn()
  }
}))

const aes = vi.mocked(audioEffectsService)
const psvc = vi.mocked(playoutService)

const cfg = {
  id: 'cfg1',
  profileId: 'p1',
  crossfadeEnabled: true,
  crossfadeMs: 4000,
  crossfadeCurve: 'equal-power' as const,
  createdAt: '',
  updatedAt: ''
}

describe('usePlayout — integración audio-effects', () => {
  const callbacks: Record<string, (...args: unknown[]) => void> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(callbacks).forEach((k) => delete callbacks[k])
    aes.get.mockResolvedValue(cfg)
    aes.update.mockResolvedValue({ ...cfg, crossfadeMs: 6000 })
    psvc.start.mockResolvedValue({
      state: 'playing',
      profileId: 'p1',
      track: null,
      queueIndex: 0,
      queueLength: 0,
      songsSinceLastAd: 0
    })

    vi.mocked(Howl).mockImplementation(
      () =>
        ({
          play: vi.fn(),
          pause: vi.fn(),
          stop: vi.fn(),
          unload: vi.fn(),
          seek: vi.fn(() => 0),
          duration: vi.fn(() => 0),
          playing: vi.fn(() => false),
          fade: vi.fn(),
          once: vi.fn(),
          volume: vi.fn(() => 1),
          _sounds: []
        }) as unknown as Howl
    )

    Object.defineProperty(window, 'electronAPI', {
      value: {
        on: vi.fn((channel: string, cb: (...args: unknown[]) => void) => {
          callbacks[channel] = cb
        }),
        off: vi.fn(),
        playout: {
          next: vi.fn(),
          getStatus: vi.fn().mockResolvedValue({
            state: 'idle',
            track: null,
            queueIndex: 0,
            queueLength: 0,
            songsSinceLastAd: 0
          })
        },
        audio: { getServerPort: vi.fn().mockResolvedValue(0) }
      },
      writable: true,
      configurable: true
    })
  })

  it('start() carga la configuración de efectos y la expone en el hook', async () => {
    const { result } = renderHook(() => usePlayout())

    await act(async () => {
      await result.current.start('p1')
    })

    expect(aes.get).toHaveBeenCalledWith('p1')
    await waitFor(() => expect(result.current.audioEffects?.crossfadeMs).toBe(4000))
  })

  it('reacciona al evento flux:audio-effects-changed y recarga config', async () => {
    const { result } = renderHook(() => usePlayout())

    await act(async () => {
      await result.current.start('p1')
    })
    await waitFor(() => expect(aes.get).toHaveBeenCalled())
    const callsBefore = aes.get.mock.calls.length

    aes.get.mockResolvedValueOnce({ ...cfg, crossfadeMs: 8000 })

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('flux:audio-effects-changed', { detail: { profileId: 'p1' } })
      )
    })

    await waitFor(() => expect(aes.get.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('updateAudioEffects delega en el service y dispara el evento global', async () => {
    const { result } = renderHook(() => usePlayout())

    await act(async () => {
      await result.current.start('p1')
    })
    await waitFor(() => expect(result.current.audioEffects).not.toBeNull())

    const evtSpy = vi.fn()
    window.addEventListener('flux:audio-effects-changed', evtSpy as EventListener)

    await act(async () => {
      await result.current.updateAudioEffects?.({
        crossfadeEnabled: true,
        crossfadeMs: 6000,
        crossfadeCurve: 'equal-power'
      })
    })

    expect(aes.update).toHaveBeenCalledWith({
      profileId: 'p1',
      crossfadeEnabled: true,
      crossfadeMs: 6000,
      crossfadeCurve: 'equal-power'
    })
    expect(evtSpy).toHaveBeenCalled()
    window.removeEventListener('flux:audio-effects-changed', evtSpy as EventListener)
  })
})
