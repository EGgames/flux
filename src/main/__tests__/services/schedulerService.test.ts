import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node-cron', () => ({
  default: { schedule: vi.fn(() => ({ stop: vi.fn() })) }
}))

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}))

import cron from 'node-cron'
import { SchedulerService } from '../../services/schedulerService'
import type { DbClient } from '../../db/types'
import { createDbMock, createWindowMock } from '../helpers/ipcHarness'

describe('SchedulerService', () => {
  let db: ReturnType<typeof createDbMock>
  let win: ReturnType<typeof createWindowMock>
  let service: SchedulerService

  beforeEach(() => {
    vi.clearAllMocks()
    db = createDbMock()
    win = createWindowMock()
    service = new SchedulerService(db as unknown as DbClient, win.win)
  })

  describe('start/stop', () => {
    it('schedules a cron task on start', async () => {
      await service.start()
      expect(cron.schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function))
    })

    it('stops scheduled tasks', async () => {
      const stopSpy = vi.fn()
      ;(cron.schedule as ReturnType<typeof vi.fn>).mockReturnValueOnce({ stop: stopSpy })

      await service.start()
      service.stop()

      expect(stopSpy).toHaveBeenCalled()
    })
  })

  describe('getActiveProgram', () => {
    it('queries by current day and time', async () => {
      db.radioProgram.findFirst.mockResolvedValue({ id: 'prog1' })

      const result = await service.getActiveProgram('p1')

      expect(db.radioProgram.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          profileId: 'p1',
          enabled: true
        }),
        orderBy: { priority: 'desc' }
      }))
      expect(result).toEqual({ id: 'prog1' })
    })
  })

  describe('tick (via cron callback)', () => {
    it('emits scheduler:program-changed with active program', async () => {
      let cronCallback: () => Promise<void> = async () => {}
      ;(cron.schedule as ReturnType<typeof vi.fn>).mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
        cronCallback = cb
        return { stop: vi.fn() }
      })

      db.profile.findMany.mockResolvedValue([{ id: 'p1' }])
      db.radioProgram.findFirst.mockResolvedValue({
        id: 'prog1', name: 'Mañana', playlistId: 'pl1', dayOfWeek: 1,
        startTime: '08:00', endTime: '10:00'
      })
      db.playlist.findFirst.mockResolvedValue(null)

      await service.start()
      await cronCallback()

      expect(win.send).toHaveBeenCalledWith('scheduler:program-changed', expect.objectContaining({
        program: expect.objectContaining({ id: 'prog1', isGeneral: false }),
        transition: { fadeOutMs: 1200, fadeInMs: 1200 }
      }))
    })

    it('emits __general__ context when no active program', async () => {
      let cronCallback: () => Promise<void> = async () => {}
      ;(cron.schedule as ReturnType<typeof vi.fn>).mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
        cronCallback = cb
        return { stop: vi.fn() }
      })

      db.profile.findMany.mockResolvedValue([{ id: 'p1' }])
      db.radioProgram.findFirst.mockResolvedValue(null)
      db.playlist.findFirst.mockResolvedValue({ id: 'pl1' })

      await service.start()
      await cronCallback()

      expect(win.send).toHaveBeenCalledWith('scheduler:program-changed', expect.objectContaining({
        program: expect.objectContaining({
          id: '__general__',
          isGeneral: true,
          playlistId: 'pl1'
        })
      }))
    })

    it('does NOT re-emit when context.id has not changed', async () => {
      let cronCallback: () => Promise<void> = async () => {}
      ;(cron.schedule as ReturnType<typeof vi.fn>).mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
        cronCallback = cb
        return { stop: vi.fn() }
      })

      db.profile.findMany.mockResolvedValue([{ id: 'p1' }])
      db.radioProgram.findFirst.mockResolvedValue({
        id: 'prog1', name: 'A', playlistId: 'pl1', dayOfWeek: 1, startTime: '08:00', endTime: '10:00'
      })
      db.playlist.findFirst.mockResolvedValue(null)

      await service.start()
      await cronCallback()
      await cronCallback()

      expect(win.send).toHaveBeenCalledTimes(1)
    })

    it('emits again when context changes between ticks', async () => {
      let cronCallback: () => Promise<void> = async () => {}
      ;(cron.schedule as ReturnType<typeof vi.fn>).mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
        cronCallback = cb
        return { stop: vi.fn() }
      })

      db.profile.findMany.mockResolvedValue([{ id: 'p1' }])
      db.radioProgram.findFirst
        .mockResolvedValueOnce({ id: 'prog1', name: 'A', playlistId: null, dayOfWeek: 1, startTime: '08:00', endTime: '10:00' })
        .mockResolvedValueOnce({ id: 'prog2', name: 'B', playlistId: null, dayOfWeek: 1, startTime: '10:00', endTime: '12:00' })
      db.playlist.findFirst.mockResolvedValue(null)

      await service.start()
      await cronCallback()
      await cronCallback()

      expect(win.send).toHaveBeenCalledTimes(2)
    })

    it('swallows errors gracefully', async () => {
      let cronCallback: () => Promise<void> = async () => {}
      ;(cron.schedule as ReturnType<typeof vi.fn>).mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
        cronCallback = cb
        return { stop: vi.fn() }
      })

      db.profile.findMany.mockRejectedValue(new Error('DB down'))

      await service.start()
      await expect(cronCallback()).resolves.toBeUndefined()
    })
  })
})
