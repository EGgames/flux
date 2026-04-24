import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}))

import { PlayoutService } from '../../services/playoutService'
import type { PrismaClient } from '@prisma/client'
import type { SchedulerService } from '../../services/schedulerService'
import type { StreamingService } from '../../services/streamingService'
import { createDbMock, createWindowMock } from '../helpers/ipcHarness'

const trackA = { id: 't1', name: 'A', sourcePath: '/a.mp3', sourceType: 'local', durationMs: 1000 }
const trackB = { id: 't2', name: 'B', sourcePath: '/b.mp3', sourceType: 'local', durationMs: 2000 }

describe('PlayoutService', () => {
  let db: ReturnType<typeof createDbMock>
  let win: ReturnType<typeof createWindowMock>
  let scheduler: SchedulerService
  let streaming: StreamingService
  let service: PlayoutService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    db = createDbMock()
    win = createWindowMock()
    scheduler = {} as SchedulerService
    streaming = {} as StreamingService
    service = new PlayoutService(db as unknown as PrismaClient, scheduler, streaming, win.win)
  })

  describe('start', () => {
    it('loads queue from a specific playlist when playlistId provided', async () => {
      db.playlist.findUnique.mockResolvedValue({
        items: [
          { audioAsset: trackA, position: 0 },
          { audioAsset: trackB, position: 1 }
        ]
      })

      const status = await service.start('p1', 'pl1')

      expect(db.playlist.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'pl1' }
      }))
      expect(status.state).toBe('playing')
      expect(status.queueLength).toBe(2)
      expect(status.queueIndex).toBe(0)
      expect(status.track).toEqual(trackA)
    })

    it('falls back to resolving current playlist when no playlistId given', async () => {
      db.radioProgram.findFirst.mockResolvedValue(null)
      db.playlist.findFirst.mockResolvedValue({
        items: [{ audioAsset: trackA }]
      })

      const status = await service.start('p1')

      expect(status.queueLength).toBe(1)
    })

    it('clamps startIndex within bounds', async () => {
      db.playlist.findUnique.mockResolvedValue({
        items: [{ audioAsset: trackA }, { audioAsset: trackB }]
      })

      const status = await service.start('p1', 'pl1', 99)
      expect(status.queueIndex).toBe(1)
    })

    it('emits playout:state-changed and playout:track-changed', async () => {
      db.playlist.findUnique.mockResolvedValue({
        items: [{ audioAsset: trackA }]
      })

      await service.start('p1', 'pl1')

      const channels = win.send.mock.calls.map((c) => c[0])
      expect(channels).toContain('playout:state-changed')
      expect(channels).toContain('playout:track-changed')
    })
  })

  describe('pause/resume', () => {
    beforeEach(async () => {
      db.playlist.findUnique.mockResolvedValue({
        items: [{ audioAsset: trackA }]
      })
      await service.start('p1', 'pl1')
      win.send.mockClear()
    })

    it('pauses when playing', () => {
      service.pause()
      expect(service.getStatus().state).toBe('paused')
      expect(win.send).toHaveBeenCalledWith('playout:state-changed', { state: 'paused' })
    })

    it('does not pause when stopped', () => {
      // Stop first
      void service.stop()
      win.send.mockClear()
      service.pause()
      expect(win.send).not.toHaveBeenCalledWith('playout:state-changed', expect.objectContaining({ state: 'paused' }))
    })

    it('resumes from paused', () => {
      service.pause()
      win.send.mockClear()
      service.resume()
      expect(service.getStatus().state).toBe('playing')
      expect(win.send).toHaveBeenCalledWith('playout:state-changed', { state: 'playing' })
    })
  })

  describe('jumpTo', () => {
    beforeEach(async () => {
      db.playlist.findUnique.mockResolvedValue({
        items: [{ audioAsset: trackA }, { audioAsset: trackB }]
      })
      await service.start('p1', 'pl1')
      win.send.mockClear()
    })

    it('moves to specified index', () => {
      service.jumpTo(1)
      expect(service.getStatus().queueIndex).toBe(1)
    })

    it('clamps negative to 0', () => {
      service.jumpTo(-5)
      expect(service.getStatus().queueIndex).toBe(0)
    })

    it('clamps above length to last', () => {
      service.jumpTo(10)
      expect(service.getStatus().queueIndex).toBe(1)
    })

    it('is a no-op when queue is empty', async () => {
      await service.stop()
      service.jumpTo(5)
      expect(service.getStatus().queueIndex).toBe(0)
    })
  })

  describe('next', () => {
    beforeEach(async () => {
      db.playlist.findUnique.mockResolvedValue({
        items: [{ audioAsset: trackA }, { audioAsset: trackB }]
      })
      db.adRule.findMany.mockResolvedValue([])
      await service.start('p1', 'pl1')
      win.send.mockClear()
    })

    it('advances to next track', async () => {
      await service.next()
      expect(service.getStatus().queueIndex).toBe(1)
    })

    it('stops when reaching end of queue', async () => {
      await service.next() // index 1
      await service.next() // beyond — should stop
      expect(service.getStatus().state).toBe('stopped')
    })
  })

  describe('triggerAdBlock', () => {
    beforeEach(async () => {
      db.playlist.findUnique.mockResolvedValue({
        items: [{ audioAsset: trackA }]
      })
      await service.start('p1', 'pl1')
      win.send.mockClear()
    })

    it('emits playout:ad-start and changes state', async () => {
      db.adBlock.findUnique.mockResolvedValue({ id: 'b1', name: 'B', items: [] })

      await service.triggerAdBlock('b1')

      expect(service.getStatus().state).toBe('ad_break')
      expect(win.send).toHaveBeenCalledWith('playout:ad-start', expect.objectContaining({
        block: expect.objectContaining({ id: 'b1' })
      }))
    })

    it('throws when ad block not found', async () => {
      db.adBlock.findUnique.mockResolvedValue(null)
      await expect(service.triggerAdBlock('missing')).rejects.toThrow('Tanda no encontrada')
    })
  })

  describe('adBreakEnd', () => {
    it('returns to playing when previous state was playing', async () => {
      db.playlist.findUnique.mockResolvedValue({ items: [{ audioAsset: trackA }] })
      await service.start('p1', 'pl1')
      db.adBlock.findUnique.mockResolvedValue({ id: 'b1', name: 'B', items: [] })
      await service.triggerAdBlock('b1')

      service.adBreakEnd()

      expect(service.getStatus().state).toBe('playing')
    })
  })

  describe('stop', () => {
    it('clears queue and records playoutEvent', async () => {
      db.playlist.findUnique.mockResolvedValue({ items: [{ audioAsset: trackA }] })
      await service.start('p1', 'pl1')

      await service.stop()

      const status = service.getStatus()
      expect(status.state).toBe('stopped')
      expect(status.queueLength).toBe(0)
      expect(db.playoutEvent.create).toHaveBeenCalledWith({
        data: { profileId: 'p1', eventType: 'stop', payload: '{}' }
      })
    })
  })
})
