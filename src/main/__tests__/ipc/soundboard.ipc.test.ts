import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { registerSoundboardIpc } from '../../ipc/soundboard.ipc'
import type { PrismaClient } from '@prisma/client'
import { ipcMain } from 'electron'
import { getRegisteredHandlers, invokeHandler, createDbMock } from '../helpers/ipcHarness'

describe('soundboard.ipc', () => {
  let db: ReturnType<typeof createDbMock>
  let handlers: Map<string, (...args: unknown[]) => unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ipcMain.handle as ReturnType<typeof vi.fn>).mockClear()
    db = createDbMock()
    registerSoundboardIpc(db as unknown as PrismaClient)
    handlers = getRegisteredHandlers()
  })

  it('registers all expected handlers', () => {
    for (const ch of ['soundboard:get', 'soundboard:assign', 'soundboard:trigger']) {
      expect(handlers.has(ch)).toBe(true)
    }
  })

  describe('soundboard:get', () => {
    it('returns 16 slots, filling missing with defaults', async () => {
      db.soundboardButton.findMany.mockResolvedValue([
        { id: 'b1', slotIndex: 1, label: 'Hit', audioAssetId: 'a1', audioAsset: { id: 'a1' }, mode: 'oneshot', color: '#fff' }
      ])

      const grid = await invokeHandler<unknown[]>(handlers, 'soundboard:get', 'p1')

      expect(grid).toHaveLength(16)
      expect((grid[0] as { id: string }).id).toBe('b1')
      const slot2 = grid[1] as { id: null; slotIndex: number; mode: string; color: string }
      expect(slot2.id).toBeNull()
      expect(slot2.slotIndex).toBe(2)
      expect(slot2.mode).toBe('oneshot')
      expect(slot2.color).toBe('#3a7bd5')
    })
  })

  describe('soundboard:assign', () => {
    it('rejects slot index < 1', async () => {
      await expect(invokeHandler(handlers, 'soundboard:assign', 'p1', 0, {}))
        .rejects.toThrow('Slot inválido. Debe estar entre 1 y 16')
    })

    it('rejects slot index > 16', async () => {
      await expect(invokeHandler(handlers, 'soundboard:assign', 'p1', 17, {}))
        .rejects.toThrow('Slot inválido. Debe estar entre 1 y 16')
    })

    it('upserts on composite (profileId, slotIndex)', async () => {
      db.soundboardButton.upsert.mockResolvedValue({ id: 'b1' })
      const data = { audioAssetId: 'a1', label: 'Test' }

      await invokeHandler(handlers, 'soundboard:assign', 'p1', 5, data)

      expect(db.soundboardButton.upsert).toHaveBeenCalledWith({
        where: { profileId_slotIndex: { profileId: 'p1', slotIndex: 5 } },
        update: data,
        create: { profileId: 'p1', slotIndex: 5, ...data }
      })
    })
  })

  describe('soundboard:trigger', () => {
    it('returns slot info when audio is assigned', async () => {
      db.soundboardButton.findUnique.mockResolvedValue({
        slotIndex: 3, mode: 'loop', audioAsset: { id: 'a1', name: 'Jingle' }
      })

      const result = await invokeHandler(handlers, 'soundboard:trigger', 'p1', 3)

      expect(result).toEqual({
        slotIndex: 3,
        mode: 'loop',
        audioAsset: { id: 'a1', name: 'Jingle' }
      })
    })

    it('throws when slot has no audio', async () => {
      db.soundboardButton.findUnique.mockResolvedValue(null)
      await expect(invokeHandler(handlers, 'soundboard:trigger', 'p1', 3))
        .rejects.toThrow('El botón 3 no tiene audio asignado')
    })

    it('throws when audioAsset is null', async () => {
      db.soundboardButton.findUnique.mockResolvedValue({ slotIndex: 3, mode: 'oneshot', audioAsset: null })
      await expect(invokeHandler(handlers, 'soundboard:trigger', 'p1', 3))
        .rejects.toThrow('El botón 3 no tiene audio asignado')
    })
  })
})
