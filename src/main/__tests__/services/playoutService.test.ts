import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}))

import { PlayoutService } from '../../services/playoutService'
import type { DbClient } from '../../db/types'
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
    db.adRule.findMany.mockResolvedValue([])
    win = createWindowMock()
    scheduler = {} as SchedulerService
    streaming = {} as StreamingService
    service = new PlayoutService(db as unknown as DbClient, scheduler, streaming, win.win)
  })

  afterEach(() => {
    ;(service as unknown as { clearSongCountWatcher: () => void }).clearSongCountWatcher()
    vi.useRealTimers()
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

    it('uses radio program playlist when one is active', async () => {
      db.radioProgram.findFirst.mockResolvedValue({
        playlist: {
          items: [{ audioAsset: trackB }]
        }
      })

      const status = await service.start('p1')

      expect(db.playlist.findFirst).not.toHaveBeenCalled()
      expect(status.track).toEqual(trackB)
      expect(status.queueLength).toBe(1)
    })

    it('clamps negative startIndex to zero', async () => {
      db.playlist.findUnique.mockResolvedValue({
        items: [{ audioAsset: trackA }, { audioAsset: trackB }]
      })

      const status = await service.start('p1', 'pl1', -7)
      expect(status.queueIndex).toBe(0)
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

    it('is a no-op when queue is empty', async () => {
      await service.stop()
      win.send.mockClear()

      await service.next()

      expect(service.getStatus().queueLength).toBe(0)
      expect(win.send).not.toHaveBeenCalledWith('playout:track-changed', expect.anything())
    })

    it('triggers ad break when song_count rule threshold is reached', async () => {
      db.adRule.findMany.mockResolvedValue([
        {
          adBlockId: 'b1',
          triggerConfig: '{"count":1}'
        }
      ])
      db.adBlock.findUnique.mockResolvedValue({ id: 'b1', name: 'Tanda 1', items: [] })

      await service.next()

      expect(service.getStatus().state).toBe('ad_break')
      expect(win.send).toHaveBeenCalledWith('playout:ad-start', expect.anything())
    })

    it('fires pending ad block at song boundary before normal next flow', async () => {
      ;(service as unknown as { pendingAdBlockId: string | null }).pendingAdBlockId = 'b2'
      db.adBlock.findUnique.mockResolvedValue({ id: 'b2', name: 'Tanda 2', items: [] })

      await service.next()

      expect((service as unknown as { pendingAdBlockId: string | null }).pendingAdBlockId).toBeNull()
      expect(service.getStatus().state).toBe('ad_break')
      expect(service.getStatus().songsSinceLastAd).toBe(0)
    })
  })

  describe('prev', () => {
    it('goes back one track when possible', async () => {
      db.playlist.findUnique.mockResolvedValue({
        items: [{ audioAsset: trackA }, { audioAsset: trackB }]
      })
      await service.start('p1', 'pl1')
      await service.next()

      service.prev()

      expect(service.getStatus().queueIndex).toBe(0)
    })

    it('does nothing when already at first track', async () => {
      db.playlist.findUnique.mockResolvedValue({
        items: [{ audioAsset: trackA }, { audioAsset: trackB }]
      })
      await service.start('p1', 'pl1')

      service.prev()

      expect(service.getStatus().queueIndex).toBe(0)
    })
  })

  describe('syncProgram', () => {
    it('returns current status without syncing when stopped', async () => {
      const result = await service.syncProgram('p1')

      expect(result.state).toBe('stopped')
      expect(db.playlist.findUnique).not.toHaveBeenCalled()
      expect(db.radioProgram.findFirst).not.toHaveBeenCalled()
    })

    it('returns current status when profile does not match active profile', async () => {
      db.playlist.findUnique.mockResolvedValue({ items: [{ audioAsset: trackA }] })
      await service.start('p1', 'pl1')
      win.send.mockClear()

      const result = await service.syncProgram('p2', 'pl2')

      expect(result.profileId).toBe('p1')
      expect(db.playlist.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'pl2' } }))
      expect(win.send).not.toHaveBeenCalledWith('playout:track-changed', expect.anything())
    })

    it('reloads queue from playlistId when profile matches', async () => {
      db.playlist.findUnique
        .mockResolvedValueOnce({ items: [{ audioAsset: trackA }] })
        .mockResolvedValueOnce({ items: [{ audioAsset: trackB }] })
      await service.start('p1', 'pl1')

      const result = await service.syncProgram('p1', 'pl2')

      expect(result.queueIndex).toBe(0)
      expect(result.track).toEqual(trackB)
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

    it('returns to stopped when previous state was stopped', () => {
      service.adBreakEnd()

      expect(service.getStatus().state).toBe('stopped')
      expect(win.send).toHaveBeenCalledWith('playout:ad-end', {})
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

    it('does not persist playoutEvent when there is no active profile', async () => {
      await service.stop()

      expect(db.playoutEvent.create).not.toHaveBeenCalled()
    })
  })

  describe('time-based ad rules watcher', () => {
    it('schedules pending ad when legacy HH:MM rule matches current minute', async () => {
      vi.setSystemTime(new Date(2026, 3, 24, 10, 15, 0, 0))
      const now = new Date()
      const firstTick = new Date(now.getTime() + 60_000)
      const currentTime = `${String(firstTick.getHours()).padStart(2, '0')}:${String(firstTick.getMinutes()).padStart(2, '0')}`
      db.playlist.findUnique.mockResolvedValue({
        items: [{ audioAsset: trackA }, { audioAsset: trackB }]
      })
      db.adRule.findMany.mockImplementation(async (args?: { where?: { triggerType?: string } }) => {
        if (args?.where?.triggerType === 'song_count') return []
        return [
          {
            adBlockId: 'b-legacy',
            triggerConfig: currentTime,
            adBlock: { name: 'Legacy Rule' }
          }
        ]
      })

      await service.start('p1', 'pl1')
      await vi.advanceTimersByTimeAsync(60_000)

      expect(win.send).toHaveBeenCalledWith('playout:ad-pending', {
        adBlockId: 'b-legacy',
        name: 'Legacy Rule'
      })
    })
  })
})
