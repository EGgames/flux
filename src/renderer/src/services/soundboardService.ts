export const soundboardService = {
  get: (profileId: string) => window.electronAPI.soundboard.get(profileId),
  assign: (
    profileId: string,
    slotIndex: number,
    data: {
      audioAssetId?: string | null
      label?: string
      mode?: 'oneshot' | 'toggle' | 'loop'
      color?: string
    }
  ) => window.electronAPI.soundboard.assign(profileId, slotIndex, data),
  trigger: (profileId: string, slotIndex: number) =>
    window.electronAPI.soundboard.trigger(profileId, slotIndex)
}
