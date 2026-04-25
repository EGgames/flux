import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { registerAdBlockIpc } from '../../ipc/adBlocks.ipc'
import type { PrismaClient } from '@prisma/client'
import { ipcMain } from 'electron'
import { getRegisteredHandlers, invokeHandler, createDbMock } from '../helpers/ipcHarness'

describe('adBlocks.ipc', () => {
  let db: ReturnType<typeof createDbMock>
  let handlers: Map<string, (...args: unknown[]) => unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ipcMain.handle as ReturnType<typeof vi.fn>).mockClear()
    db = createDbMock()
    registerAdBlockIpc(db as unknown as PrismaClient)
    handlers = getRegisteredHandlers()
  })

  it('registers all expected handlers', () => {
    const expected = [
      'ad-block:list', 'ad-block:get-with-items', 'ad-block:create', 'ad-block:update',
      'ad-block:delete', 'ad-block:add-item', 'ad-block:remove-item', 'ad-block:trigger',
      'ad-rule:list', 'ad-rule:create', 'ad-rule:update', 'ad-rule:delete'
    ]
    for (const ch of expected) expect(handlers.has(ch)).toBe(true)
  })

  describe('ad-block:list', () => {
    it('queries by profileId with includes and orderBy name asc', async () => {
      db.adBlock.findMany.mockResolvedValue([])
      await invokeHandler(handlers, 'ad-block:list', 'p1')
      expect(db.adBlock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { profileId: 'p1' },
        orderBy: { name: 'asc' }
      }))
    })
  })

  describe('ad-block:create', () => {
    it('creates a block with given data', async () => {
      db.adBlock.create.mockResolvedValue({ id: 'b1' })
      await invokeHandler(handlers, 'ad-block:create', { name: 'B', profileId: 'p1' })
      expect(db.adBlock.create).toHaveBeenCalledWith({ data: { name: 'B', profileId: 'p1' } })
    })
  })

  describe('ad-block:get-with-items', () => {
    it('queries block by id including items and rules', async () => {
      db.adBlock.findUnique.mockResolvedValue({ id: 'b1' })

      const result = await invokeHandler(handlers, 'ad-block:get-with-items', 'b1')

      expect(db.adBlock.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'b1' },
        include: expect.objectContaining({
          items: expect.any(Object),
          rules: true
        })
      }))
      expect(result).toEqual({ id: 'b1' })
    })
  })

  describe('ad-block:update', () => {
    it('updates block data by id', async () => {
      db.adBlock.update.mockResolvedValue({ id: 'b1', name: 'B2' })

      await invokeHandler(handlers, 'ad-block:update', 'b1', { name: 'B2', enabled: true })

      expect(db.adBlock.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { name: 'B2', enabled: true }
      })
    })
  })

  describe('ad-block:delete', () => {
    it('deletes by id and returns success', async () => {
      const result = await invokeHandler(handlers, 'ad-block:delete', 'b1')

      expect(db.adBlock.delete).toHaveBeenCalledWith({ where: { id: 'b1' } })
      expect(result).toEqual({ success: true })
    })
  })

  describe('ad-block:add-item', () => {
    it('creates ad block item with adBlockId/audioAssetId/position', async () => {
      db.adBlockItem.create.mockResolvedValue({ id: 'abi1' })

      await invokeHandler(handlers, 'ad-block:add-item', 'b1', 'a1', 3)

      expect(db.adBlockItem.create).toHaveBeenCalledWith({
        data: { adBlockId: 'b1', audioAssetId: 'a1', position: 3 }
      })
    })
  })

  describe('ad-block:remove-item', () => {
    it('deletes ad block item and returns success', async () => {
      const result = await invokeHandler(handlers, 'ad-block:remove-item', 'abi1')

      expect(db.adBlockItem.delete).toHaveBeenCalledWith({ where: { id: 'abi1' } })
      expect(result).toEqual({ success: true })
    })
  })

  describe('ad-block:trigger', () => {
    it('returns block when found', async () => {
      const block = { id: 'b1', items: [] }
      db.adBlock.findUnique.mockResolvedValue(block)
      const result = await invokeHandler(handlers, 'ad-block:trigger', 'b1')
      expect(result).toEqual(block)
    })

    it('throws when block not found', async () => {
      db.adBlock.findUnique.mockResolvedValue(null)
      await expect(invokeHandler(handlers, 'ad-block:trigger', 'b1')).rejects.toThrow('Tanda no encontrada')
    })
  })

  describe('ad-rule:create', () => {
    it('throws when missing required fields', async () => {
      await expect(invokeHandler(handlers, 'ad-rule:create', {
        profileId: '', adBlockId: 'b1', triggerType: 'time', triggerConfig: 'x', priority: 1
      })).rejects.toThrow('profileId, adBlockId y triggerType son obligatorios')
    })

    it('rejects duplicate time rule', async () => {
      db.adRule.findFirst.mockResolvedValue({ id: 'existing' })
      await expect(invokeHandler(handlers, 'ad-rule:create', {
        profileId: 'p1', adBlockId: 'b1', triggerType: 'time',
        triggerConfig: '{"dayOfWeek":1,"time":"10:00"}', priority: 1
      })).rejects.toThrow('Ese horario ya existe para la tanda seleccionada')
      expect(db.adRule.create).not.toHaveBeenCalled()
    })

    it('creates rule when not duplicate', async () => {
      db.adRule.findFirst.mockResolvedValue(null)
      db.adRule.create.mockResolvedValue({ id: 'r1' })
      const data = {
        profileId: 'p1', adBlockId: 'b1', triggerType: 'time',
        triggerConfig: '{"dayOfWeek":1,"time":"10:00"}', priority: 1
      }
      await invokeHandler(handlers, 'ad-rule:create', data)
      expect(db.adRule.create).toHaveBeenCalledWith({ data })
    })

    it('creates non-time rule without duplicate check', async () => {
      db.adRule.create.mockResolvedValue({ id: 'r1' })
      await invokeHandler(handlers, 'ad-rule:create', {
        profileId: 'p1', adBlockId: 'b1', triggerType: 'song_count',
        triggerConfig: '4', priority: 1
      })
      expect(db.adRule.findFirst).not.toHaveBeenCalled()
      expect(db.adRule.create).toHaveBeenCalled()
    })
  })

  describe('ad-rule:list', () => {
    it('lists profile rules ordered by priority and createdAt', async () => {
      db.adRule.findMany.mockResolvedValue([{ id: 'r1' }])

      const result = await invokeHandler(handlers, 'ad-rule:list', 'p1')

      expect(db.adRule.findMany).toHaveBeenCalledWith({
        where: { profileId: 'p1' },
        include: { adBlock: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
      })
      expect(result).toEqual([{ id: 'r1' }])
    })
  })

  describe('ad-rule:update', () => {
    it('updates ad rule fields', async () => {
      db.adRule.update.mockResolvedValue({ id: 'r1' })

      await invokeHandler(handlers, 'ad-rule:update', 'r1', {
        triggerConfig: '{"time":"10:00"}',
        priority: 10,
        enabled: false
      })

      expect(db.adRule.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { triggerConfig: '{"time":"10:00"}', priority: 10, enabled: false }
      })
    })
  })

  describe('ad-rule:delete', () => {
    it('deletes and returns success', async () => {
      const result = await invokeHandler(handlers, 'ad-rule:delete', 'r1')
      expect(db.adRule.delete).toHaveBeenCalledWith({ where: { id: 'r1' } })
      expect(result).toEqual({ success: true })
    })
  })
})
