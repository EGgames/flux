import type { BrowserWindow } from 'electron'
import type { PrismaClient } from '@prisma/client'
import type { SchedulerService } from './schedulerService'
import type { StreamingService } from './streamingService'
import log from 'electron-log'

export type PlayoutState = 'stopped' | 'playing' | 'paused' | 'ad_break'

interface PlayoutStatus {
  state: PlayoutState
  profileId: string | null
  track: {
    id: string
    name: string
    sourcePath: string
    sourceType: string
    durationMs: number | null
  } | null
  queueIndex: number
  queueLength: number
  songsSinceLastAd: number
}

export class PlayoutService {
  private state: PlayoutState = 'stopped'
  private prevAdState: PlayoutState = 'stopped'
  private profileId: string | null = null
  private queue: Array<{
    id: string
    name: string
    sourcePath: string
    sourceType: string
    durationMs: number | null
  }> = []
  private queueIndex = 0
  private songsSinceLastAd = 0
  private pendingAdBlockId: string | null = null
  private adRuleInterval: NodeJS.Timeout | null = null

  private async resolveCurrentPlaylist(profileId: string): Promise<Array<{
    id: string
    name: string
    sourcePath: string
    sourceType: string
    durationMs: number | null
  }>> {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const program = await this.db.radioProgram.findFirst({
      where: {
        profileId,
        dayOfWeek,
        startTime: { lte: timeStr },
        endTime: { gte: timeStr },
        enabled: true
      },
      include: {
        playlist: {
          include: { items: { include: { audioAsset: true }, orderBy: { position: 'asc' } } }
        }
      },
      orderBy: { priority: 'desc' }
    })

    if (program?.playlist?.items?.length) {
      return program.playlist.items.map((item) => item.audioAsset)
    }

    const generalPlaylist = await this.db.playlist.findFirst({
      where: { profileId, enabled: true },
      include: { items: { include: { audioAsset: true }, orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' }
    })

    return generalPlaylist?.items.map((item) => item.audioAsset) ?? []
  }

  constructor(
    private db: PrismaClient,
    schedulerService: SchedulerService,
    streamingService: StreamingService,
    private win: BrowserWindow
  ) {
    // Reserved for future cross-service coordination (program changes, live streaming).
    void schedulerService
    void streamingService
  }

  async start(profileId: string, playlistId?: string, startIndex = 0): Promise<PlayoutStatus> {
    this.profileId = profileId
    this.state = 'playing'
    this.songsSinceLastAd = 0

    if (playlistId) {
      const playlist = await this.db.playlist.findUnique({
        where: { id: playlistId },
        include: { items: { include: { audioAsset: true }, orderBy: { position: 'asc' } } }
      })
      this.queue = playlist?.items.map((i) => i.audioAsset) ?? []
    } else {
      this.queue = await this.resolveCurrentPlaylist(profileId)
    }

    this.queueIndex = Math.min(Math.max(0, startIndex), Math.max(0, this.queue.length - 1))
    this.emitStateChange()
    this.emitTrackChange()
    this.startSongCountWatcher(profileId)

    return this.getStatus()
  }

  pause(): void {
    if (this.state === 'playing') {
      this.state = 'paused'
      this.emitStateChange()
    }
  }

  resume(): void {
    if (this.state === 'paused') {
      this.state = 'playing'
      this.emitStateChange()
    }
  }

  async stop(): Promise<void> {
    const profileId = this.profileId
    this.state = 'stopped'
    this.queue = []
    this.queueIndex = 0
    this.profileId = null
    this.clearSongCountWatcher()
    this.emitStateChange()
    if (profileId) {
      await this.db.playoutEvent.create({
        data: { profileId, eventType: 'stop', payload: '{}' }
      })
    }
  }

  jumpTo(index: number): void {
    if (this.queue.length === 0) return
    const clamped = Math.min(Math.max(0, index), this.queue.length - 1)
    this.queueIndex = clamped
    this.emitTrackChange()
  }

  prev(): void {
    if (this.queue.length === 0) return
    const prevIndex = this.queueIndex - 1
    if (prevIndex < 0) return
    this.queueIndex = prevIndex
    this.emitTrackChange()
  }

  async next(): Promise<void> {
    if (this.queue.length === 0) return

    // If a time-based ad block is pending, fire it at this song boundary
    if (this.pendingAdBlockId) {
      const pendingId = this.pendingAdBlockId
      this.pendingAdBlockId = null
      // Advance to the next track so it plays after the ads finish
      const ni = this.queueIndex + 1
      this.queueIndex = ni < this.queue.length ? ni : 0
      this.songsSinceLastAd = 0
      await this.triggerAdBlock(pendingId)
      return
    }

    const nextIndex = this.queueIndex + 1
    if (nextIndex >= this.queue.length) {
      this.state = 'stopped'
      this.queueIndex = 0
      this.clearSongCountWatcher()
      this.emitStateChange()
      return
    }
    this.queueIndex = nextIndex
    this.songsSinceLastAd++

    // Check song-count rules BEFORE emitting track-changed so that if an ad
    // fires, adBreakEnd() handles emitting the next track (no race condition)
    await this.checkSongCountRules()
    if (this.state === 'playing') {
      this.emitTrackChange()
    }
  }

  async syncProgram(profileId: string, playlistId?: string | null): Promise<PlayoutStatus> {
    if (this.state === 'stopped') {
      return this.getStatus()
    }

    if (this.profileId !== profileId) {
      return this.getStatus()
    }

    if (playlistId) {
      const playlist = await this.db.playlist.findUnique({
        where: { id: playlistId },
        include: { items: { include: { audioAsset: true }, orderBy: { position: 'asc' } } }
      })
      this.queue = playlist?.items.map((item) => item.audioAsset) ?? []
    } else {
      this.queue = await this.resolveCurrentPlaylist(profileId)
    }

    this.queueIndex = 0
    this.emitTrackChange()
    this.emitStateChange()
    return this.getStatus()
  }

  async triggerAdBlock(adBlockId: string): Promise<void> {
    const block = await this.db.adBlock.findUnique({
      where: { id: adBlockId },
      include: { items: { include: { audioAsset: true }, orderBy: { position: 'asc' } } }
    })
    if (!block) throw new Error('Tanda no encontrada')

    this.prevAdState = this.state
    this.state = 'ad_break'
    this.win.webContents.send('playout:ad-start', { block })
    this.emitStateChange()

    await this.db.playoutEvent.create({
      data: {
        profileId: this.profileId,
        eventType: 'ad_start',
        payload: JSON.stringify({ adBlockId, name: block.name })
      }
    })
  }

  adBreakEnd(): void {
    const nextState: PlayoutState = this.prevAdState === 'stopped' ? 'stopped' : 'playing'
    this.state = nextState
    this.songsSinceLastAd = 0
    this.emitStateChange()
    this.win.webContents.send('playout:ad-end', {})
    if (nextState === 'playing') {
      this.emitTrackChange()
    }
  }

  getStatus(): PlayoutStatus {
    return {
      state: this.state,
      profileId: this.profileId,
      track: this.queue[this.queueIndex] ?? null,
      queueIndex: this.queueIndex,
      queueLength: this.queue.length,
      songsSinceLastAd: this.songsSinceLastAd
    }
  }

  private async checkSongCountRules(): Promise<void> {
    if (!this.profileId) return
    const rules = await this.db.adRule.findMany({
      where: { profileId: this.profileId, triggerType: 'song_count', enabled: true },
      include: { adBlock: true },
      orderBy: { priority: 'desc' }
    })
    for (const rule of rules) {
      const config = JSON.parse(rule.triggerConfig)
      if (this.songsSinceLastAd >= config.count) {
        await this.triggerAdBlock(rule.adBlockId)
        break
      }
    }
  }

  private startSongCountWatcher(profileId: string): void {
    this.clearSongCountWatcher()
    // Emit a tick every minute to check time-based rules
    this.adRuleInterval = setInterval(async () => {
      if (!this.profileId || this.state !== 'playing') return
      const now = new Date()
      const dayOfWeek = now.getDay()
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const rules = await this.db.adRule.findMany({
        where: { profileId, triggerType: 'time', enabled: true },
        include: { adBlock: true },
        orderBy: { priority: 'desc' }
      })
      for (const rule of rules) {
        let config: unknown
        try {
          config = JSON.parse(rule.triggerConfig)
        } catch {
          config = rule.triggerConfig
        }

        // Legacy format compatibility: triggerConfig = "HH:MM"
        if (typeof config === 'string' && config === timeStr) {
          this.schedulePendingAdBlock(rule.adBlockId, rule.adBlock?.name ?? 'Tanda')
          break
        }

        const typedConfig = (typeof config === 'object' && config !== null ? config : {}) as {
          dayOfWeek?: number
          time?: string
        }
        const ruleDay = typeof typedConfig.dayOfWeek === 'number' ? typedConfig.dayOfWeek : null
        const ruleTime = typeof typedConfig.time === 'string' ? typedConfig.time : null
        if (ruleTime && ruleDay !== null && ruleDay === dayOfWeek && ruleTime === timeStr) {
          this.schedulePendingAdBlock(rule.adBlockId, rule.adBlock?.name ?? 'Tanda')
          break
        }

        // Previous JSON format compatibility: { time: "HH:MM" }
        if (ruleTime && ruleDay === null && ruleTime === timeStr) {
          this.schedulePendingAdBlock(rule.adBlockId, rule.adBlock?.name ?? 'Tanda')
          break
        }
      }
    }, 60_000)
  }

  private schedulePendingAdBlock(adBlockId: string, name: string): void {
    this.pendingAdBlockId = adBlockId
    this.win.webContents.send('playout:ad-pending', { adBlockId, name })
    log.info(`[PlayoutService] Tanda programada al fin del tema: "${name}" (${adBlockId})`)
  }

  private clearSongCountWatcher(): void {
    if (this.adRuleInterval) {
      clearInterval(this.adRuleInterval)
      this.adRuleInterval = null
    }
  }

  private emitStateChange(): void {
    this.win.webContents.send('playout:state-changed', { state: this.state })
  }

  private emitTrackChange(): void {
    const track = this.queue[this.queueIndex] ?? null
    if (track) {
      this.win.webContents.send('playout:track-changed', {
        track,
        queueIndex: this.queueIndex,
        queueLength: this.queue.length
      })
      this.win.webContents.send('playout:queue-update', {
        queue: this.queue,
        queueIndex: this.queueIndex
      })
    }
  }
}
