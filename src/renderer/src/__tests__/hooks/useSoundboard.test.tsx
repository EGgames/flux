import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSoundboard } from '@renderer/hooks/useSoundboard'
import { soundboardService } from '@renderer/services/soundboardService'

vi.mock('@renderer/services/soundboardService', () => ({
  soundboardService: {
    get: vi.fn(),
    assign: vi.fn(),
    trigger: vi.fn()
  }
}))

const mocked = vi.mocked(soundboardService)

function button(slotIndex: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `b-${slotIndex}`,
    profileId: 'p1',
    slotIndex,
    label: 'Btn',
    audioAssetId: 'a1',
    audioAsset: {
      id: 'a1',
      name: 'Asset',
      sourceType: 'local',
      sourcePath: 'C\\music\\song.mp3',
      durationMs: null,
      tags: '{}',
      createdAt: '',
      updatedAt: ''
    },
    mode: 'oneshot',
    color: '#fff',
    ...overrides
  }
}

describe('useSoundboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const howlInstance = {
      play: vi.fn(),
      stop: vi.fn(),
      playing: vi.fn(() => false)
    }
    ;(globalThis as unknown as { Howl: unknown }).Howl = vi.fn(() => howlInstance)
  })

  it('does not load with null profile', async () => {
    const { result } = renderHook(() => useSoundboard(null))
    await act(async () => { await result.current.reload() })
    expect(mocked.get).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.assign(1, { label: 'NoProfile' })
      await result.current.trigger(1)
    })
    expect(mocked.assign).not.toHaveBeenCalled()
    expect(mocked.trigger).not.toHaveBeenCalled()
  })

  it('loads and assigns button', async () => {
    mocked.get.mockResolvedValue([button(1), button(2)] as never)
    mocked.assign.mockResolvedValue({ ...button(1), label: 'Updated' } as never)

    const { result } = renderHook(() => useSoundboard('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.assign(1, { label: 'Updated' })
    })

    expect(mocked.assign).toHaveBeenCalledWith('p1', 1, { label: 'Updated' })
    expect(result.current.buttons[0].label).toBe('Updated')
    expect(result.current.buttons[1].label).toBe('Btn')
  })

  it('triggers oneshot and toggle-stop branch', async () => {
    const playingHowl = {
      play: vi.fn(),
      stop: vi.fn(),
      playing: vi.fn(() => true)
    }
    const idleHowl = {
      play: vi.fn(),
      stop: vi.fn(),
      playing: vi.fn(() => false)
    }
    const howlFactory = vi.fn()
      .mockImplementationOnce(() => playingHowl)
      .mockImplementation(() => idleHowl)
    ;(globalThis as unknown as { Howl: unknown }).Howl = howlFactory

    mocked.get.mockResolvedValue([button(1)] as never)
    mocked.trigger
      .mockResolvedValueOnce({ mode: 'toggle', audioAsset: button(1).audioAsset } as never)
      .mockResolvedValueOnce({ mode: 'toggle', audioAsset: button(1).audioAsset } as never)

    const { result } = renderHook(() => useSoundboard('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.trigger(1) })
    await act(async () => { await result.current.trigger(1) })

    expect(mocked.trigger).toHaveBeenCalledTimes(2)
    expect(playingHowl.stop).toHaveBeenCalledTimes(1)
  })

  it('handles trigger error silently', async () => {
    mocked.get.mockResolvedValue([button(1)] as never)
    mocked.trigger.mockRejectedValue(new Error('not assigned'))

    const { result } = renderHook(() => useSoundboard('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(result.current.trigger(1)).resolves.toBeUndefined()
  })

  it('stops existing howl on non-toggle re-trigger', async () => {
    const first = {
      play: vi.fn(),
      stop: vi.fn(),
      playing: vi.fn(() => false)
    }
    const second = {
      play: vi.fn(),
      stop: vi.fn(),
      playing: vi.fn(() => false)
    }
    const howlFactory = vi.fn()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(() => second)
    ;(globalThis as unknown as { Howl: unknown }).Howl = howlFactory

    mocked.get.mockResolvedValue([button(1)] as never)
    mocked.trigger.mockResolvedValue({ mode: 'oneshot', audioAsset: button(1).audioAsset } as never)

    const { result } = renderHook(() => useSoundboard('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.trigger(1) })
    await act(async () => { await result.current.trigger(1) })

    expect(first.stop).toHaveBeenCalledTimes(1)
  })

  it('uses stream source path when sourceType is stream', async () => {
    const howlFactory = vi.fn(() => ({
      play: vi.fn(),
      stop: vi.fn(),
      playing: vi.fn(() => false)
    }))
    ;(globalThis as unknown as { Howl: unknown }).Howl = howlFactory

    mocked.get.mockResolvedValue([button(1)] as never)
    mocked.trigger.mockResolvedValue({
      mode: 'oneshot',
      audioAsset: {
        ...button(1).audioAsset,
        sourceType: 'stream',
        sourcePath: 'https://example.com/jingle.mp3'
      }
    } as never)

    const { result } = renderHook(() => useSoundboard('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.trigger(1) })

    expect(howlFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        src: ['https://example.com/jingle.mp3']
      })
    )
  })
})
