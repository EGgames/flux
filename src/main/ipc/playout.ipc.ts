import { ipcMain, BrowserWindow } from 'electron'
import type { DbClient } from '../db/types'
import type { SchedulerService } from '../services/schedulerService'
import type { StreamingService } from '../services/streamingService'
import { PlayoutService } from '../services/playoutService'

let playoutService: PlayoutService | null = null

export function registerPlayoutIpc(
  db: DbClient,
  schedulerService: SchedulerService,
  streamingService: StreamingService,
  win: BrowserWindow
): void {
  ipcMain.handle(
    'playout:start',
    async (_event, profileId: string, playlistId?: string, startIndex?: number) => {
      if (!playoutService) {
        playoutService = new PlayoutService(db, schedulerService, streamingService, win)
      }
      return playoutService.start(profileId, playlistId, startIndex ?? 0)
    }
  )

  ipcMain.handle('playout:stop', async () => {
    await playoutService?.stop()
    return { success: true }
  })

  ipcMain.handle('playout:pause', async () => {
    playoutService?.pause()
    return { success: true }
  })

  ipcMain.handle('playout:resume', async () => {
    playoutService?.resume()
    return { success: true }
  })

  ipcMain.handle('playout:next', async () => {
    await playoutService?.next()
    return { success: true }
  })

  ipcMain.handle('playout:sync-program', async (_event, profileId: string, playlistId?: string | null) => {
    if (!playoutService) {
      return { state: 'stopped', track: null, profileId: null, queueIndex: 0, queueLength: 0, songsSinceLastAd: 0 }
    }
    return playoutService.syncProgram(profileId, playlistId)
  })

  ipcMain.handle('playout:status', () => {
    return playoutService?.getStatus() ?? { state: 'stopped', track: null, profileId: null }
  })

  ipcMain.handle('playout:trigger-ad', async (_event, adBlockId: string) => {
    await playoutService?.triggerAdBlock(adBlockId)
    return { success: true }
  })

  ipcMain.handle('playout:prev', () => {
    playoutService?.prev()
    return { success: true }
  })

  ipcMain.handle('playout:jump-to', (_event, index: number) => {
    playoutService?.jumpTo(index)
    return { success: true }
  })

  ipcMain.handle('playout:ad-end-ack', () => {
    playoutService?.adBreakEnd()
    return { success: true }
  })

  ipcMain.handle('playout:stop-ad', () => {
    playoutService?.stopAdBreak()
    return { success: true }
  })

  // Receive audio chunks from renderer for streaming
  ipcMain.handle('playout:stream-chunk', (_event, chunk: ArrayBuffer) => {
    streamingService.pushChunk(Buffer.from(chunk))
  })
}
