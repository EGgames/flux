import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Howl, Howler } from 'howler'
import { usePlayout } from '@renderer/hooks/usePlayout'
import { playoutService } from '@renderer/services/playoutService'
import { outputService } from '@renderer/services/outputService'

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
  fade: vi.fn(),
  once: vi.fn(),
  volume: vi.fn(() => 1),
  _sounds: []
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
          next: vi.fn(),
          getStatus: vi.fn().mockResolvedValue({ state: 'idle', track: null, queueIndex: 0, queueLength: 0, songsSinceLastAd: 0 })
        },
        audio: {
          getServerPort: vi.fn().mockResolvedValue(0)
        }
      },
      writable: true,
      configurable: true
    })
  })

  it('subscribes and unsubscribes ipc events', () => {
    const { unmount } = renderHook(() => usePlayout())

    expect(on).toHaveBeenCalledTimes(7)
    unmount()
    expect(off).toHaveBeenCalledTimes(7)
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

    const opts = vi.mocked(Howl).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>

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

    const opts = vi.mocked(Howl).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>
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

  describe('Equalizer (10 bandas)', () => {
    it('expone 10 frecuencias ISO y preset Flat por defecto', () => {
      const { result } = renderHook(() => usePlayout())
      expect(result.current.equalizerFrequencies).toEqual([31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000])
      expect(result.current.equalizer.gains).toHaveLength(10)
      expect(result.current.equalizer.gains.every((g) => g === 0)).toBe(true)
      expect(result.current.equalizer.presetId).toBe('flat')
      // Built-ins (10): flat, rock, jazz, pop, classical, bass-boost, treble-boost, vocal, dance, loudness
      expect(result.current.equalizerPresets.length).toBeGreaterThanOrEqual(10)
    })

    it('setEqualizerBand actualiza la banda y marca presetId=custom', () => {
      const { result } = renderHook(() => usePlayout())
      act(() => { result.current.setEqualizerBand(0, 6) })
      expect(result.current.equalizer.gains[0]).toBe(6)
      expect(result.current.equalizer.presetId).toBe('custom')
    })

    it('setEqualizerBand clampea valores fuera de rango y rechaza índices inválidos', () => {
      const { result } = renderHook(() => usePlayout())
      act(() => { result.current.setEqualizerBand(0, 999) })
      expect(result.current.equalizer.gains[0]).toBe(12)
      act(() => { result.current.setEqualizerBand(0, -999) })
      expect(result.current.equalizer.gains[0]).toBe(-12)
      act(() => { result.current.setEqualizerBand(99, 5) })
      expect(result.current.equalizer.gains[0]).toBe(-12) // sin cambio
    })

    it('toggleEqualizer cambia el flag enabled', () => {
      const { result } = renderHook(() => usePlayout())
      act(() => { result.current.toggleEqualizer(false) })
      expect(result.current.equalizer.enabled).toBe(false)
      act(() => { result.current.toggleEqualizer(true) })
      expect(result.current.equalizer.enabled).toBe(true)
    })

    it('applyEqualizerPreset aplica las ganancias del preset', () => {
      const { result } = renderHook(() => usePlayout())
      act(() => { result.current.applyEqualizerPreset('rock') })
      expect(result.current.equalizer.presetId).toBe('rock')
      const rock = result.current.equalizerPresets.find((p) => p.id === 'rock')!
      expect(result.current.equalizer.gains).toEqual(rock.gains)
    })

    it('applyEqualizerPreset ignora ids inexistentes', () => {
      const { result } = renderHook(() => usePlayout())
      act(() => { result.current.applyEqualizerPreset('rock') })
      const previousGains = result.current.equalizer.gains
      act(() => { result.current.applyEqualizerPreset('no-existe') })
      expect(result.current.equalizer.gains).toEqual(previousGains)
    })

    it('resetEqualizer pone gains en 0 y preset flat', () => {
      const { result } = renderHook(() => usePlayout())
      act(() => { result.current.applyEqualizerPreset('bass-boost') })
      act(() => { result.current.resetEqualizer() })
      expect(result.current.equalizer.gains.every((g) => g === 0)).toBe(true)
      expect(result.current.equalizer.presetId).toBe('flat')
    })

    it('saveEqualizerPreset valida nombre vacío y duplicados', () => {
      const { result } = renderHook(() => usePlayout())
      let res!: ReturnType<typeof result.current.saveEqualizerPreset>
      act(() => { res = result.current.saveEqualizerPreset('   ') })
      expect(res.ok).toBe(false)
      expect(res.error).toMatch(/vacío/)

      act(() => { res = result.current.saveEqualizerPreset('Rock') })
      expect(res.ok).toBe(false)
      expect(res.error).toMatch(/Ya existe/)

      act(() => { res = result.current.saveEqualizerPreset('Mi Mix') })
      expect(res.ok).toBe(true)
      expect(res.id).toBeTruthy()
      expect(result.current.equalizerPresets.some((p) => p.name === 'Mi Mix')).toBe(true)
    })

    it('deleteEqualizerPreset rechaza built-ins y elimina customs', () => {
      const { result } = renderHook(() => usePlayout())
      let saved!: ReturnType<typeof result.current.saveEqualizerPreset>
      act(() => { saved = result.current.saveEqualizerPreset('Custom Test') })
      expect(saved.ok).toBe(true)

      let resDelete!: ReturnType<typeof result.current.deleteEqualizerPreset>
      act(() => { resDelete = result.current.deleteEqualizerPreset('flat') })
      expect(resDelete.ok).toBe(false)
      expect(resDelete.error).toMatch(/built-in/)

      act(() => { resDelete = result.current.deleteEqualizerPreset(saved.id!) })
      expect(resDelete.ok).toBe(true)
      expect(result.current.equalizerPresets.some((p) => p.id === saved.id)).toBe(false)
    })
  })

  describe('Logs panel', () => {
    it('inicia con array vacío y permite limpiar', () => {
      const { result } = renderHook(() => usePlayout())
      expect(result.current.logs).toEqual([])
      // El cambio de track produce un log
      act(() => {
        callbacks['playout:track-changed']?.({
          track: { id: 't1', name: 'Tema 1', sourceType: 'local', sourcePath: 'x.mp3', durationMs: null, tags: '{}', createdAt: '', updatedAt: '' }
        })
      })
      expect(result.current.logs.length).toBeGreaterThan(0)
      const entry = result.current.logs[0]
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('timestamp')
      expect(entry).toHaveProperty('level')
      expect(entry).toHaveProperty('message')

      act(() => { result.current.clearLogs() })
      expect(result.current.logs).toEqual([])
    })
  })

  it('setVolume clampea entre 0 y 1 y delega en Howler.volume', () => {
    const { result } = renderHook(() => usePlayout())

    const volumeSpy = vi.spyOn(Howler, 'volume').mockImplementation(() => 0)

    act(() => { result.current.setVolume(2) })
    expect(volumeSpy).toHaveBeenCalledWith(1)
    expect(result.current.volume).toBe(1)

    act(() => { result.current.setVolume(-1) })
    expect(volumeSpy).toHaveBeenCalledWith(0)
    expect(result.current.volume).toBe(0)
  })

  it('onplayerror registra warning y reintenta con once unlock', async () => {
    const instance = {
      ...defaultHowlInstance,
      play: vi.fn(),
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'unlock') cb()
      })
    }
    vi.mocked(Howl).mockImplementation(() => instance as unknown as Howl)

    renderHook(() => usePlayout())
    const track = {
      id: 'a4',
      name: 'RetryMe',
      sourceType: 'local',
      sourcePath: 'C:\\music\\retry.mp3',
      durationMs: null,
      tags: '{}',
      createdAt: '',
      updatedAt: ''
    }

    act(() => {
      callbacks['playout:track-changed']?.({ track })
    })

    const opts = vi.mocked(Howl).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>
    act(() => {
      ;(opts.onplayerror as (id: number, err: unknown) => void)?.(0, 'locked')
    })

    await waitFor(() => expect(instance.once).toHaveBeenCalledWith('unlock', expect.any(Function)))
    expect(instance.play).toHaveBeenCalled()
  })

  it('aplica sink local y monitor cuando hay outputs habilitados', async () => {
    const mainSetSinkId = vi.fn().mockResolvedValue(undefined)
    const monitorSetSinkId = vi.fn().mockResolvedValue(undefined)

    class FakeAudioContext {
      public currentTime = 0
      public sampleRate = 48000
      public state: 'running' | 'suspended' = 'running'
      public destination = {}
      public sinkId?: string

      constructor(opts?: { sinkId?: string }) {
        this.sinkId = opts?.sinkId
      }

      createBiquadFilter() {
        return {
          type: 'peaking',
          frequency: { value: 0 },
          Q: { value: 0 },
          gain: { value: 0, setTargetAtTime: vi.fn() },
          connect: vi.fn()
        }
      }

      createMediaElementSource() {
        return { connect: vi.fn(), disconnect: vi.fn() }
      }

      async resume() {
        this.state = 'running'
      }

      async setSinkId(id: string) {
        this.sinkId = id
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: FakeAudioContext
    })

    const mainInstance = {
      ...defaultHowlInstance,
      _sounds: [{ _node: { crossOrigin: '', setSinkId: mainSetSinkId } }],
      play: vi.fn(),
      duration: vi.fn(() => 120)
    }
    const monitorInstance = {
      ...defaultHowlInstance,
      _sounds: [{ _node: { setSinkId: monitorSetSinkId } }],
      play: vi.fn()
    }

    vi.mocked(Howl)
      .mockImplementationOnce(() => mainInstance as unknown as Howl)
      .mockImplementationOnce(() => monitorInstance as unknown as Howl)

    mockedOutput.list.mockResolvedValue([
      { id: 'o1', outputType: 'local', enabled: true, config: JSON.stringify({ deviceId: 'dev-main' }) } as never,
      { id: 'o2', outputType: 'monitor', enabled: true, config: JSON.stringify({ deviceId: 'dev-monitor' }) } as never
    ])

    const { result } = renderHook(() => usePlayout())
    mocked.start.mockResolvedValueOnce({
      state: 'playing',
      profileId: 'p1',
      track: null,
      queueIndex: 0,
      queueLength: 1,
      songsSinceLastAd: 0
    } as never)

    await act(async () => {
      await result.current.start('p1')
    })

    const track = {
      id: 'sink-1',
      name: 'Sink test',
      sourceType: 'local',
      sourcePath: 'C:\\music\\sink.mp3',
      durationMs: 120000,
      tags: '{}',
      createdAt: '',
      updatedAt: ''
    }

    act(() => {
      callbacks['playout:track-changed']?.({ track })
    })

    const mainOpts = vi.mocked(Howl).mock.calls[0][0] as unknown as Record<string, unknown>
    const monitorOpts = vi.mocked(Howl).mock.calls[1][0] as unknown as Record<string, unknown>

    await act(async () => {
      ;(mainOpts.onplay as () => void)?.()
      ;(monitorOpts.onplay as () => void)?.()
    })

    await waitFor(() => {
      expect(mainSetSinkId).toHaveBeenCalledWith('dev-main')
      expect(monitorSetSinkId).toHaveBeenCalledWith('dev-monitor')
    })
  })
})
