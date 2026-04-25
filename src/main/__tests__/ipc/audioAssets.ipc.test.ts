import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => {
  const ipcMain = { handle: vi.fn() }
  const dialog = { showOpenDialog: vi.fn() }
  const BrowserWindow = { fromWebContents: vi.fn(() => ({})) }

  return {
    ipcMain,
    dialog,
    BrowserWindow,
    default: {
      ipcMain,
      dialog,
      BrowserWindow
    }
  }
})

vi.mock('../../utils/audio', () => ({
  getAudioDurationMs: vi.fn(async () => 12345)
}))

import { registerAudioAssetIpc } from '../../ipc/audioAssets.ipc'
import type { PrismaClient } from '@prisma/client'
import { ipcMain } from 'electron'
import { getRegisteredHandlers, invokeHandler, createDbMock } from '../helpers/ipcHarness'

describe('audioAssets.ipc', () => {
  let db: ReturnType<typeof createDbMock>
  let handlers: Map<string, (...args: unknown[]) => unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ipcMain.handle as ReturnType<typeof vi.fn>).mockClear()
    db = createDbMock()
    registerAudioAssetIpc(db as unknown as PrismaClient)
    handlers = getRegisteredHandlers()
  })

  it('registers all expected handlers', () => {
    for (const ch of [
      'audio-asset:list', 'audio-asset:pick-files', 'audio-asset:import',
      'audio-asset:import-batch', 'audio-asset:delete'
    ]) expect(handlers.has(ch)).toBe(true)
  })

  describe('audio-asset:list', () => {
    it('returns assets ordered by name asc', async () => {
      db.audioAsset.findMany.mockResolvedValue([{ id: 'a1' }])
      const result = await invokeHandler(handlers, 'audio-asset:list')
      expect(db.audioAsset.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } })
      expect(result).toEqual([{ id: 'a1' }])
    })
  })

  describe('audio-asset:import', () => {
    it('creates asset deriving name from filename', async () => {
      db.audioAsset.create.mockResolvedValue({ id: 'a1' })

      await invokeHandler(handlers, 'audio-asset:import', '/path/to/Hit Song.mp3')

      expect(db.audioAsset.create).toHaveBeenCalledWith({
        data: { name: 'Hit Song', sourceType: 'local', sourcePath: '/path/to/Hit Song.mp3', durationMs: 12345 }
      })
    })
  })

  describe('audio-asset:import-batch', () => {
    it('imports multiple files in order', async () => {
      db.audioAsset.create
        .mockResolvedValueOnce({ id: 'a1' })
        .mockResolvedValueOnce({ id: 'a2' })

      const result = await invokeHandler<unknown[]>(handlers, 'audio-asset:import-batch', ['/x.mp3', '/y.wav'])

      expect(db.audioAsset.create).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
    })

    it('returns empty array for empty input', async () => {
      const result = await invokeHandler<unknown[]>(handlers, 'audio-asset:import-batch', [])
      expect(result).toEqual([])
      expect(db.audioAsset.create).not.toHaveBeenCalled()
    })

    it('derives each asset name from extensionless filename', async () => {
      db.audioAsset.create
        .mockResolvedValueOnce({ id: 'a1', name: 'x' })
        .mockResolvedValueOnce({ id: 'a2', name: 'y' })

      await invokeHandler(handlers, 'audio-asset:import-batch', ['/music/X.m4a', '/music/Y.aac'])

      expect(db.audioAsset.create).toHaveBeenNthCalledWith(1, {
        data: { name: 'X', sourceType: 'local', sourcePath: '/music/X.m4a', durationMs: 12345 }
      })
      expect(db.audioAsset.create).toHaveBeenNthCalledWith(2, {
        data: { name: 'Y', sourceType: 'local', sourcePath: '/music/Y.aac', durationMs: 12345 }
      })
    })
  })

  describe('audio-asset:delete', () => {
    it('returns success', async () => {
      const result = await invokeHandler(handlers, 'audio-asset:delete', 'a1')
      expect(db.audioAsset.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
      expect(result).toEqual({ success: true })
    })
  })

  describe('audio-assets:update-fades', () => {
    it('persiste fades válidos', async () => {
      db.audioAsset.update.mockResolvedValue({ id: 'a1' })
      await invokeHandler(handlers, 'audio-assets:update-fades', {
        assetId: 'a1',
        fadeInMs: 1000,
        fadeOutMs: 2500
      })
      expect(db.audioAsset.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { fadeInMs: 1000, fadeOutMs: 2500 }
      })
    })

    it('clamp >15000 a 15000', async () => {
      db.audioAsset.update.mockResolvedValue({ id: 'a1' })
      await invokeHandler(handlers, 'audio-assets:update-fades', {
        assetId: 'a1',
        fadeInMs: 99999,
        fadeOutMs: null
      })
      const arg = db.audioAsset.update.mock.calls[0][0]
      expect(arg.data.fadeInMs).toBe(15000)
      expect(arg.data.fadeOutMs).toBeNull()
    })

    it('valores no positivos se guardan como null', async () => {
      db.audioAsset.update.mockResolvedValue({ id: 'a1' })
      await invokeHandler(handlers, 'audio-assets:update-fades', {
        assetId: 'a1',
        fadeInMs: 0,
        fadeOutMs: -100
      })
      const arg = db.audioAsset.update.mock.calls[0][0]
      expect(arg.data.fadeInMs).toBeNull()
      expect(arg.data.fadeOutMs).toBeNull()
    })

    it('null se preserva como null', async () => {
      db.audioAsset.update.mockResolvedValue({ id: 'a1' })
      await invokeHandler(handlers, 'audio-assets:update-fades', {
        assetId: 'a1',
        fadeInMs: null,
        fadeOutMs: null
      })
      const arg = db.audioAsset.update.mock.calls[0][0]
      expect(arg.data.fadeInMs).toBeNull()
      expect(arg.data.fadeOutMs).toBeNull()
    })
  })
})
