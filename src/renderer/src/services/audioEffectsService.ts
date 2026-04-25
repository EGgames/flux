import type { AudioAsset, AudioEffectsConfig } from '@renderer/types/ipc.types'

export const audioEffectsService = {
  get: (profileId: string): Promise<AudioEffectsConfig | null> =>
    window.electronAPI.audioEffects.get(profileId),
  update: (payload: {
    profileId: string
    crossfadeEnabled?: boolean
    crossfadeMs?: number
    crossfadeCurve?: 'equal-power' | 'linear'
  }): Promise<AudioEffectsConfig> => window.electronAPI.audioEffects.update(payload),
  updateAssetFades: (
    assetId: string,
    fadeInMs: number | null,
    fadeOutMs: number | null
  ): Promise<AudioAsset> => window.electronAPI.audioAssets.updateFades(assetId, fadeInMs, fadeOutMs)
}
