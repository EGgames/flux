import { describe, it, expect, vi, beforeEach } from 'vitest'
import { soundboardService } from '@renderer/services/soundboardService'

describe('soundboardService', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      value: {
        soundboard: {
          get: vi.fn(),
          assign: vi.fn(),
          trigger: vi.fn()
        }
      },
      writable: true,
      configurable: true
    })
  })

  it('delegates all soundboard methods', async () => {
    await soundboardService.get('p1')
    await soundboardService.assign('p1', 2, { label: 'Jingle', audioAssetId: 'a1', mode: 'toggle', color: '#fff' })
    await soundboardService.trigger('p1', 2)

    expect(window.electronAPI.soundboard.get).toHaveBeenCalledWith('p1')
    expect(window.electronAPI.soundboard.assign).toHaveBeenCalledWith('p1', 2, { label: 'Jingle', audioAssetId: 'a1', mode: 'toggle', color: '#fff' })
    expect(window.electronAPI.soundboard.trigger).toHaveBeenCalledWith('p1', 2)
  })
})
