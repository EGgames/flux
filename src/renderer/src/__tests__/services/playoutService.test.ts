import { describe, it, expect, vi, beforeEach } from 'vitest'
import { playoutService } from '@renderer/services/playoutService'

describe('playoutService', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      value: {
        playout: {
          start: vi.fn(),
          stop: vi.fn(),
          pause: vi.fn(),
          resume: vi.fn(),
          next: vi.fn(),
          getStatus: vi.fn(),
          triggerAdBlock: vi.fn(),
          streamChunk: vi.fn()
        }
      },
      writable: true,
      configurable: true
    })
  })

  it('delegates all playout methods', async () => {
    await playoutService.start('p1', 'pl1')
    await playoutService.stop()
    await playoutService.pause()
    await playoutService.resume()
    await playoutService.next()
    await playoutService.getStatus()
    await playoutService.triggerAdBlock('ab1')
    await playoutService.streamChunk(new ArrayBuffer(8))

    expect(window.electronAPI.playout.start).toHaveBeenCalledWith('p1', 'pl1', undefined)
    expect(window.electronAPI.playout.stop).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.playout.pause).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.playout.resume).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.playout.next).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.playout.getStatus).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.playout.triggerAdBlock).toHaveBeenCalledWith('ab1')
    expect(window.electronAPI.playout.streamChunk).toHaveBeenCalledTimes(1)
  })
})
