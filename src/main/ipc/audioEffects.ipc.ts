import { ipcMain } from 'electron'
import type { DbClient } from '../db/types'

export function registerAudioEffectsIpc(db: DbClient): void {
  ipcMain.handle('audio-effects:get', async (_event, profileId: string) => {
    if (!profileId) return null
    const cfg = await db.audioEffectsConfig.findUnique({ where: { profileId } })
    if (cfg) return cfg
    return db.audioEffectsConfig.create({
      data: { profileId }
    })
  })

  ipcMain.handle(
    'audio-effects:update',
    async (
      _event,
      payload: {
        profileId: string
        crossfadeEnabled?: boolean
        crossfadeMs?: number
        crossfadeCurve?: string
      }
    ) => {
      const { profileId, ...rest } = payload
      const data: Record<string, unknown> = {}
      if (typeof rest.crossfadeEnabled === 'boolean') {
        data.crossfadeEnabled = rest.crossfadeEnabled
      }
      if (typeof rest.crossfadeMs === 'number') {
        data.crossfadeMs = Math.min(15000, Math.max(500, Math.round(rest.crossfadeMs)))
      }
      if (rest.crossfadeCurve === 'equal-power' || rest.crossfadeCurve === 'linear') {
        data.crossfadeCurve = rest.crossfadeCurve
      }
      return db.audioEffectsConfig.upsert({
        where: { profileId },
        update: data,
        create: { profileId, ...data }
      })
    }
  )
}
