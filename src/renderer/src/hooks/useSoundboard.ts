import { useState, useEffect, useCallback, useRef } from 'react'
import { Howl } from 'howler'
import type { SoundboardButton } from '../types/ipc.types'
import { soundboardService } from '../services/soundboardService'

export function useSoundboard(profileId: string | null) {
  const [buttons, setButtons] = useState<SoundboardButton[]>([])
  const [loading, setLoading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [gridResetKey, setGridResetKey] = useState(0)
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
      data: { audioAssetId?: string | null; label?: string; mode?: 'oneshot' | 'toggle' | 'loop'; color?: string }
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

  const stopAll = useCallback(() => {
    howlsRef.current.forEach((h) => h.stop())
    howlsRef.current.clear()
    setIsPaused(false)
    setGridResetKey((k) => k + 1)
  }, [])

  const pauseAll = useCallback(() => {
    howlsRef.current.forEach((h) => { if (h.playing()) h.pause() })
    setIsPaused(true)
  }, [])

  const resumeAll = useCallback(() => {
    howlsRef.current.forEach((h) => h.play())
    setIsPaused(false)
  }, [])

  return { buttons, loading, assign, trigger, reload: load, stopAll, pauseAll, resumeAll, isPaused, gridResetKey }
}
