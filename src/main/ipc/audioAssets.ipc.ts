import { ipcMain, dialog } from 'electron'
import type { DbClient } from '../db/types'
import path from 'path'
import { getAudioDurationMs } from '../utils/audio'

export function registerAudioAssetIpc(db: DbClient): void {
  ipcMain.handle('audio-asset:list', async () => {
    return db.audioAsset.findMany({ orderBy: { name: 'asc' } })
  })

  ipcMain.handle('audio-asset:pick-files', async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      title: 'Importar archivos de audio',
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'] }],
      properties: ['openFile', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('audio-asset:import', async (_event, filePath: string) => {
    const name = path.basename(filePath, path.extname(filePath))
    const durationMs = await getAudioDurationMs(filePath)
    return db.audioAsset.create({
      data: {
        name,
        sourceType: 'local',
        sourcePath: filePath,
        durationMs
      }
    })
  })

  ipcMain.handle('audio-asset:import-batch', async (_event, filePaths: string[]) => {
    const results: unknown[] = []
    for (const filePath of filePaths) {
      const name = path.basename(filePath, path.extname(filePath))
      const durationMs = await getAudioDurationMs(filePath)
      const asset = await db.audioAsset.create({
        data: { name, sourceType: 'local', sourcePath: filePath, durationMs }
      })
      results.push(asset)
    }
    return results
  })

  ipcMain.handle('audio-asset:delete', async (_event, id: string) => {
    await db.audioAsset.delete({ where: { id } })
    return { success: true }
  })

  ipcMain.handle(
    'audio-assets:update-fades',
    async (
      _event,
      payload: { assetId: string; fadeInMs: number | null; fadeOutMs: number | null }
    ) => {
      const { assetId, fadeInMs, fadeOutMs } = payload
      const clamp = (v: number | null): number | null => {
        if (v === null || v === undefined) return null
        const n = Math.round(Number(v))
        if (!Number.isFinite(n) || n <= 0) return null
        return Math.min(15000, Math.max(0, n))
      }
      return db.audioAsset.update({
        where: { id: assetId },
        data: { fadeInMs: clamp(fadeInMs), fadeOutMs: clamp(fadeOutMs) }
      })
    }
  )
}
