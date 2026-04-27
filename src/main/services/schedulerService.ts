import cron from 'node-cron'
import type { BrowserWindow } from 'electron'
import type { DbClient } from '../db/types'
import log from 'electron-log'

export class SchedulerService {
  private tasks: cron.ScheduledTask[] = []
  private lastProgramByProfile = new Map<string, string>()

  constructor(
    private db: DbClient,
    private win: BrowserWindow
  ) {}

  async start(): Promise<void> {
    // Run every minute to check active programs
    const task = cron.schedule('* * * * *', () => this.tick())
    this.tasks.push(task)
    log.info('SchedulerService started')
  }

  stop(): void {
    this.tasks.forEach((t) => t.stop())
    this.tasks = []
    log.info('SchedulerService stopped')
  }

  /**
   * Returns the active RadioProgram for a given profile right now.
   */
  async getActiveProgram(profileId: string) {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    return this.db.radioProgram.findFirst({
      where: {
        profileId,
        dayOfWeek,
        startTime: { lte: timeStr },
        endTime: { gte: timeStr },
        enabled: true
      },
      include: { playlist: true },
      orderBy: { priority: 'desc' }
    })
  }

  private async tick(): Promise<void> {
    try {
      const profiles = await this.db.profile.findMany()
      for (const profile of profiles) {
        const activeProgram = await this.getActiveProgram(profile.id)
        const fallbackPlaylist = await this.db.playlist.findFirst({
          where: { profileId: profile.id, enabled: true },
          orderBy: { createdAt: 'asc' }
        })

        const context = activeProgram
          ? {
            id: activeProgram.id,
            name: activeProgram.name,
            profileId: profile.id,
            playlistId: activeProgram.playlistId,
            dayOfWeek: activeProgram.dayOfWeek,
            startTime: activeProgram.startTime,
            endTime: activeProgram.endTime,
            isGeneral: false
          }
          : {
            id: '__general__',
            name: 'General',
            profileId: profile.id,
            playlistId: fallbackPlaylist?.id ?? null,
            dayOfWeek: null,
            startTime: null,
            endTime: null,
            isGeneral: true
          }

        const previousContextId = this.lastProgramByProfile.get(profile.id)
        if (previousContextId !== context.id) {
          this.lastProgramByProfile.set(profile.id, context.id)
          this.win.webContents.send('scheduler:program-changed', {
            program: context,
            transition: {
              fadeOutMs: 1200,
              fadeInMs: 1200
            }
          })
        }
      }
    } catch (err) {
      log.error('SchedulerService tick error:', err)
    }
  }
}
