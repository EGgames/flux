import { useState, useEffect, useCallback, useRef } from 'react'
import { Howl } from 'howler'
import type { SoundboardButton } from '../types/ipc.types'
import { soundboardService } from '../services/soundboardService'

export function useSoundboard(profileId: string | null) {
  const [buttons, setButtons] = useState<SoundboardButton[]>([])
  const [loading, setLoading] = useState(false)
  const howlsRef = useRef<Map<number, Howl>>(new Map())

  const load = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const data = await soundboardService.get(profileId)
    setButtons(data)
    setLoading(false)
  }, [profileId])

  useEffect(() => { load() }, [load])

  const assign = useCallback(
    async (
      slotIndex: number,
      data: { audioAssetId?: string | null; label?: string; mode?: string; color?: string }
    ) => {
      if (!profileId) return
      const updated = await soundboardService.assign(profileId, slotIndex, data)
      setButtons((prev) =>
        prev.map((b) => (b.slotIndex === slotIndex ? { ...b, ...updated } : b))
      )
    },
    [profileId]
  )

  const trigger = useCallback(
    async (slotIndex: number) => {
      if (!profileId) return
      try {
        const result = await soundboardService.trigger(profileId, slotIndex)
        const { mode, audioAsset } = result
        const src =
          audioAsset.sourceType === 'local'
            ? `local-audio://?p=${encodeURIComponent(audioAsset.sourcePath)}`
            : audioAsset.sourcePath

        const existing = howlsRef.current.get(slotIndex)

        if (mode === 'toggle' && existing?.playing()) {
          existing.stop()
          howlsRef.current.delete(slotIndex)
          return
        }
        existing?.stop()

        const howl = new Howl({ src: [src], html5: true, loop: mode === 'loop' })
        howl.play()
        howlsRef.current.set(slotIndex, howl)
      } catch {
        // Button not assigned — silently ignore
      }
    },
    [profileId]
  )

  return { buttons, loading, assign, trigger, reload: load }
}
