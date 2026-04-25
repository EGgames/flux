import { describe, it, expect, vi, beforeEach } from 'vitest'
import { audioEffectsService } from '@renderer/services/audioEffectsService'

function buildElectronMock() {
  return {
    audioEffects: {
      get: vi.fn(),
      update: vi.fn()
    },
    audioAssets: {
      updateFades: vi.fn()
    }
  }
}

describe('audioEffectsService', () => {
  let electronMock: ReturnType<typeof buildElectronMock>

  beforeEach(() => {
    electronMock = buildElectronMock()
    Object.defineProperty(window, 'electronAPI', {
      value: electronMock,
      writable: true,
      configurable: true
    })
  })

  it('delegates get to electron audioEffects.get', async () => {
    electronMock.audioEffects.get.mockResolvedValue({ id: 'cfg1' })
    const r = await audioEffectsService.get('p1')
    expect(electronMock.audioEffects.get).toHaveBeenCalledWith('p1')
    expect(r).toEqual({ id: 'cfg1' })
  })

  it('delegates update with full payload', async () => {
    const payload = {
      profileId: 'p1',
      crossfadeEnabled: true,
      crossfadeMs: 4000,
      crossfadeCurve: 'equal-power' as const
    }
    electronMock.audioEffects.update.mockResolvedValue({ ...payload, id: 'cfg1' })
    await audioEffectsService.update(payload)
    expect(electronMock.audioEffects.update).toHaveBeenCalledWith(payload)
  })

  it('delegates updateAssetFades to audioAssets.updateFades', async () => {
    await audioEffectsService.updateAssetFades('a1', 1000, 2000)
    expect(electronMock.audioAssets.updateFades).toHaveBeenCalledWith('a1', 1000, 2000)
  })

  it('updateAssetFades acepta nulls', async () => {
    await audioEffectsService.updateAssetFades('a1', null, null)
    expect(electronMock.audioAssets.updateFades).toHaveBeenCalledWith('a1', null, null)
  })
})
