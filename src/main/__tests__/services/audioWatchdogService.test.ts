import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { AudioWatchdog } from '../../services/audioWatchdogService'

describe('AudioWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-26T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function buildHarness(initial: { isPlaying: boolean; trackId: string | null; positionMs: number | null }) {
    const state = { ...initial }
    const onStall = vi.fn()
    const wd = new AudioWatchdog({
      isPlaying: () => state.isPlaying,
      getCurrentTrackId: () => state.trackId,
      getPositionMs: () => state.positionMs,
      onStall,
      stallThresholdMs: 3000,
      pollMs: 1000
    })
    return { wd, state, onStall }
  }

  it('does nothing when not playing', () => {
    const { wd, onStall } = buildHarness({ isPlaying: false, trackId: 't1', positionMs: 0 })
    wd.start()
    vi.advanceTimersByTime(10000)
    expect(onStall).not.toHaveBeenCalled()
  })

  it('does not stall while position keeps changing', () => {
    const h = buildHarness({ isPlaying: true, trackId: 't1', positionMs: 1000 })
    h.wd.start()
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(1000)
      h.state.positionMs = (h.state.positionMs ?? 0) + 1000
    }
    expect(h.onStall).not.toHaveBeenCalled()
  })

  it('emits stall when position frozen for stallThresholdMs', () => {
    const h = buildHarness({ isPlaying: true, trackId: 't1', positionMs: 5000 })
    h.wd.start()
    // primer tick: arranca tracking
    vi.advanceTimersByTime(1000)
    // congelado por 3s mas
    vi.advanceTimersByTime(3000)
    expect(h.onStall).toHaveBeenCalledWith({ trackId: 't1', reason: 'no_progress' })
  })

  it('resets stall window when track changes', () => {
    const h = buildHarness({ isPlaying: true, trackId: 't1', positionMs: 5000 })
    h.wd.start()
    vi.advanceTimersByTime(1000)
    // cambiamos de track antes de stall
    h.state.trackId = 't2'
    h.state.positionMs = 0
    vi.advanceTimersByTime(2000)
    expect(h.onStall).not.toHaveBeenCalled()
  })

  it('stop clears the timer and is safe to call twice', () => {
    const h = buildHarness({ isPlaying: true, trackId: 't1', positionMs: 0 })
    h.wd.start()
    h.wd.stop()
    h.wd.stop()
    vi.advanceTimersByTime(10000)
    expect(h.onStall).not.toHaveBeenCalled()
  })
})
