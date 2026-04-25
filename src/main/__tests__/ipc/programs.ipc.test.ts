import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { registerProgramIpc } from '../../ipc/programs.ipc'
import type { PrismaClient } from '@prisma/client'
import { ipcMain } from 'electron'
import { getRegisteredHandlers, invokeHandler, createDbMock } from '../helpers/ipcHarness'

describe('programs.ipc', () => {
  let db: ReturnType<typeof createDbMock>
  let handlers: Map<string, (...args: unknown[]) => unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ipcMain.handle as ReturnType<typeof vi.fn>).mockClear()
    db = createDbMock()
    registerProgramIpc(db as unknown as PrismaClient)
    handlers = getRegisteredHandlers()
  })

  it('registers all expected handlers', () => {
    for (const ch of ['program:list', 'program:create', 'program:update', 'program:delete']) {
      expect(handlers.has(ch)).toBe(true)
    }
  })

  describe('program:create', () => {
    const baseData = {
      profileId: 'p1', name: 'Mañanas', dayOfWeek: 1,
      startTime: '08:00', endTime: '10:00'
    }

    it('creates when there is no overlap', async () => {
      db.radioProgram.findFirst.mockResolvedValue(null)
      db.radioProgram.create.mockResolvedValue({ id: 'pr1' })

      await invokeHandler(handlers, 'program:create', baseData)

      expect(db.radioProgram.findFirst).toHaveBeenCalledWith({
        where: {
          profileId: 'p1',
          dayOfWeek: 1,
          enabled: true,
          AND: [
            { startTime: { lte: '10:00' } },
            { endTime: { gte: '08:00' } }
          ]
        }
      })
      expect(db.radioProgram.create).toHaveBeenCalledWith({ data: baseData })
    })

    it('throws on time overlap with informative message', async () => {
      db.radioProgram.findFirst.mockResolvedValue({
        id: 'existing', name: 'Otro programa', startTime: '09:00', endTime: '11:00'
      })

      await expect(invokeHandler(handlers, 'program:create', baseData))
        .rejects.toThrow('Conflicto de horario con el programa "Otro programa" (09:00–11:00)')
      expect(db.radioProgram.create).not.toHaveBeenCalled()
    })
  })

  describe('program:list', () => {
    it('orders by dayOfWeek asc then startTime asc', async () => {
      db.radioProgram.findMany.mockResolvedValue([])
      await invokeHandler(handlers, 'program:list', 'p1')
      expect(db.radioProgram.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { profileId: 'p1' },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
      }))
    })
  })

  describe('program:delete', () => {
    it('returns success', async () => {
      const result = await invokeHandler(handlers, 'program:delete', 'pr1')
      expect(db.radioProgram.delete).toHaveBeenCalledWith({ where: { id: 'pr1' } })
      expect(result).toEqual({ success: true })
    })
  })
})
