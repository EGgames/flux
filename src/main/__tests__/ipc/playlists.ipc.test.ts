import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { registerPlaylistIpc } from '../../ipc/playlists.ipc'
import type { PrismaClient } from '@prisma/client'
import { ipcMain } from 'electron'
import { getRegisteredHandlers, invokeHandler, createDbMock } from '../helpers/ipcHarness'

describe('playlists.ipc', () => {
  let db: ReturnType<typeof createDbMock>
  let handlers: Map<string, (...args: unknown[]) => unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ipcMain.handle as ReturnType<typeof vi.fn>).mockClear()
    db = createDbMock()
    registerPlaylistIpc(db as unknown as PrismaClient)
    handlers = getRegisteredHandlers()
  })

  it('registers all expected handlers', () => {
    for (const ch of [
      'playlist:list', 'playlist:get-with-items', 'playlist:create', 'playlist:update',
      'playlist:delete', 'playlist:add-item', 'playlist:remove-item', 'playlist:reorder'
    ]) expect(handlers.has(ch)).toBe(true)
  })

  describe('playlist:reorder', () => {
    it('updates positions when all items belong to playlist', async () => {
      const itemIds = ['i1', 'i2', 'i3']
      db.playlistItem.findMany.mockResolvedValue(itemIds.map((id) => ({ id })))

      await invokeHandler(handlers, 'playlist:reorder', 'pl1', itemIds)

      expect(db.playlistItem.findMany).toHaveBeenCalledWith({
        where: { id: { in: itemIds }, playlistId: 'pl1' },
        select: { id: true }
      })
      expect(db.playlistItem.update).toHaveBeenCalledTimes(3)
      expect(db.playlistItem.update).toHaveBeenNthCalledWith(1, { where: { id: 'i1' }, data: { position: 0 } })
      expect(db.playlistItem.update).toHaveBeenNthCalledWith(2, { where: { id: 'i2' }, data: { position: 1 } })
      expect(db.playlistItem.update).toHaveBeenNthCalledWith(3, { where: { id: 'i3' }, data: { position: 2 } })
    })

    it('rejects when some items do not belong to playlist (security)', async () => {
      db.playlistItem.findMany.mockResolvedValue([{ id: 'i1' }, { id: 'i2' }]) // missing i3

      await expect(invokeHandler(handlers, 'playlist:reorder', 'pl1', ['i1', 'i2', 'i3']))
        .rejects.toThrow('Algunos items no pertenecen a la playlist indicada')
      expect(db.playlistItem.update).not.toHaveBeenCalled()
    })
  })

  describe('playlist:create', () => {
    it('creates a playlist with given data', async () => {
      db.playlist.create.mockResolvedValue({ id: 'pl1' })
      await invokeHandler(handlers, 'playlist:create', { name: 'Hits', profileId: 'p1' })
      expect(db.playlist.create).toHaveBeenCalledWith({ data: { name: 'Hits', profileId: 'p1' } })
    })
  })

  describe('playlist:list', () => {
    it('queries playlists by profile with includes and orderBy name asc', async () => {
      db.playlist.findMany.mockResolvedValue([{ id: 'pl1' }])

      const result = await invokeHandler(handlers, 'playlist:list', 'p1')

      expect(db.playlist.findMany).toHaveBeenCalledWith({
        where: { profileId: 'p1' },
        include: { _count: { select: { items: true } } },
        orderBy: { name: 'asc' }
      })
      expect(result).toEqual([{ id: 'pl1' }])
    })
  })

  describe('playlist:get-with-items', () => {
    it('gets playlist with item assets ordered by position', async () => {
      db.playlist.findUnique.mockResolvedValue({ id: 'pl1', items: [] })

      const result = await invokeHandler(handlers, 'playlist:get-with-items', 'pl1')

      expect(db.playlist.findUnique).toHaveBeenCalledWith({
        where: { id: 'pl1' },
        include: {
          items: {
            include: { audioAsset: true },
            orderBy: { position: 'asc' }
          }
        }
      })
      expect(result).toEqual({ id: 'pl1', items: [] })
    })
  })

  describe('playlist:update', () => {
    it('updates playlist by id', async () => {
      db.playlist.update.mockResolvedValue({ id: 'pl1', name: 'Nuevo' })

      await invokeHandler(handlers, 'playlist:update', 'pl1', { name: 'Nuevo', enabled: false })

      expect(db.playlist.update).toHaveBeenCalledWith({
        where: { id: 'pl1' },
        data: { name: 'Nuevo', enabled: false }
      })
    })
  })

  describe('playlist:add-item', () => {
    it('creates an item with playlistId, audioAssetId, position', async () => {
      db.playlistItem.create.mockResolvedValue({ id: 'i1' })
      await invokeHandler(handlers, 'playlist:add-item', 'pl1', 'a1', 5)
      expect(db.playlistItem.create).toHaveBeenCalledWith({
        data: { playlistId: 'pl1', audioAssetId: 'a1', position: 5 }
      })
    })
  })

  describe('playlist:remove-item', () => {
    it('deletes item by id and returns success', async () => {
      const result = await invokeHandler(handlers, 'playlist:remove-item', 'i1')

      expect(db.playlistItem.delete).toHaveBeenCalledWith({ where: { id: 'i1' } })
      expect(result).toEqual({ success: true })
    })
  })

  describe('playlist:reorder edge case', () => {
    it('returns success for empty item list without updates', async () => {
      db.playlistItem.findMany.mockResolvedValue([])

      const result = await invokeHandler(handlers, 'playlist:reorder', 'pl1', [])

      expect(db.playlistItem.findMany).toHaveBeenCalledWith({
        where: { id: { in: [] }, playlistId: 'pl1' },
        select: { id: true }
      })
      expect(db.playlistItem.update).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })
  })

  describe('playlist:delete', () => {
    it('returns success', async () => {
      const result = await invokeHandler(handlers, 'playlist:delete', 'pl1')
      expect(db.playlist.delete).toHaveBeenCalledWith({ where: { id: 'pl1' } })
      expect(result).toEqual({ success: true })
    })
  })
})
