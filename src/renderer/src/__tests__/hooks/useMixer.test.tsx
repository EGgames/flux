import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Howl } from 'howler'
import { useMixer } from '@renderer/hooks/useMixer'

vi.mock('howler', () => ({
  Howl: vi.fn()
}))

interface FakeHowl {
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  unload: ReturnType<typeof vi.fn>
  volume: ReturnType<typeof vi.fn>
  duration: ReturnType<typeof vi.fn>
  seek: ReturnType<typeof vi.fn>
  _sounds: Array<{ _node: { setSinkId: ReturnType<typeof vi.fn> } }>
  _volumeArg: number | null
}

const howlInstances: FakeHowl[] = []

function makeAsset(id: string) {
  return {
    id,
    name: `Asset ${id}`,
    sourceType: 'local' as const,
    sourcePath: `C:\\music\\${id}.mp3`,
    durationMs: 180000,
    tags: '[]',
    fadeInMs: null,
    fadeOutMs: null,
    createdAt: '',
    updatedAt: ''
  }
}

beforeEach(() => {
  howlInstances.length = 0
  vi.mocked(Howl).mockImplementation(((opts: { onload?: () => void }) => {
    const inst: FakeHowl = {
      _sounds: [{ _node: { setSinkId: vi.fn().mockResolvedValue(undefined) } }],
      _volumeArg: null,
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      unload: vi.fn(),
      volume: vi.fn(function (this: FakeHowl, v?: number) {
        if (typeof v === 'number') { this._volumeArg = v; return v }
        return this._volumeArg ?? 0
      }),
      duration: vi.fn(() => 180),
      seek: vi.fn(() => 0)
    }
    howlInstances.push(inst)
    if (opts.onload) setTimeout(opts.onload, 0)
    return inst as unknown as Howl
  }) as unknown as typeof Howl)

  Object.defineProperty(window, 'electronAPI', {
    value: {
      audio: { getServerPort: vi.fn().mockResolvedValue(45000) },
      outputs: { list: vi.fn().mockResolvedValue([]) }
    },
    writable: true,
    configurable: true
  })
})

describe('useMixer', () => {
  it('inicializa con dos decks vacíos y crossfader en 0', () => {
    const { result } = renderHook(() => useMixer('p1'))
    expect(result.current.decks.A.asset).toBeNull()
    expect(result.current.decks.B.asset).toBeNull()
    expect(result.current.crossfaderPos).toBe(0)
  })

  it('loadAsset crea Howl y publica asset en el deck', async () => {
    const { result } = renderHook(() => useMixer('p1'))
    await waitFor(() => expect(window.electronAPI.audio.getServerPort).toHaveBeenCalled())
    act(() => result.current.loadAsset('A', makeAsset('a1')))
    expect(howlInstances.length).toBe(1)
    expect(result.current.decks.A.asset?.id).toBe('a1')
  })

  it('aplica curva equal-power: en pos=0 ambos decks ~0.707', () => {
    const { result } = renderHook(() => useMixer('p1'))
    act(() => result.current.loadAsset('A', makeAsset('a1')))
    act(() => result.current.loadAsset('B', makeAsset('a2')))
    act(() => result.current.setCrossfader(0))
    const a = howlInstances[0]
    const b = howlInstances[1]
    expect(a._volumeArg).toBeCloseTo(Math.SQRT1_2, 2)
    expect(b._volumeArg).toBeCloseTo(Math.SQRT1_2, 2)
  })

  it('crossfader en -1 silencia B y deja A a volumen máximo', () => {
    const { result } = renderHook(() => useMixer('p1'))
    act(() => result.current.loadAsset('A', makeAsset('a1')))
    act(() => result.current.loadAsset('B', makeAsset('a2')))
    act(() => result.current.setCrossfader(-1))
    expect(howlInstances[0]._volumeArg).toBeCloseTo(1, 2)
    expect(howlInstances[1]._volumeArg).toBeCloseTo(0, 2)
  })

  it('crossfader en +1 silencia A y deja B a volumen máximo', () => {
    const { result } = renderHook(() => useMixer('p1'))
    act(() => result.current.loadAsset('A', makeAsset('a1')))
    act(() => result.current.loadAsset('B', makeAsset('a2')))
    act(() => result.current.setCrossfader(1))
    expect(howlInstances[0]._volumeArg).toBeCloseTo(0, 2)
    expect(howlInstances[1]._volumeArg).toBeCloseTo(1, 2)
  })

  it('toggleCue se ignora cuando no hay monitor disponible', async () => {
    const { result } = renderHook(() => useMixer('p1'))
    await waitFor(() => expect(window.electronAPI.outputs.list).toHaveBeenCalled())
    act(() => result.current.loadAsset('A', makeAsset('a1')))
    act(() => result.current.toggleCue('A'))
    expect(result.current.decks.A.cued).toBe(false)
  })

  it('toggleCue activa CUE cuando hay monitor configurado', async () => {
    Object.defineProperty(window, 'electronAPI', {
      value: {
        audio: { getServerPort: vi.fn().mockResolvedValue(45000) },
        outputs: {
          list: vi.fn().mockResolvedValue([
            { id: 'o1', outputType: 'monitor', enabled: true, config: JSON.stringify({ deviceId: 'mon-1' }) }
          ])
        }
      },
      writable: true,
      configurable: true
    })
    const { result } = renderHook(() => useMixer('p1'))
    await waitFor(() => expect(result.current.monitorAvailable).toBe(true))
    act(() => result.current.loadAsset('A', makeAsset('a1')))
    act(() => result.current.toggleCue('A'))
    expect(result.current.decks.A.cued).toBe(true)
  })

  it('unloadAll limpia ambos decks', () => {
    const { result } = renderHook(() => useMixer('p1'))
    act(() => result.current.loadAsset('A', makeAsset('a1')))
    act(() => result.current.loadAsset('B', makeAsset('a2')))
    act(() => result.current.unloadAll())
    expect(result.current.decks.A.asset).toBeNull()
    expect(result.current.decks.B.asset).toBeNull()
    expect(howlInstances[0].unload).toHaveBeenCalled()
    expect(howlInstances[1].unload).toHaveBeenCalled()
  })
})
