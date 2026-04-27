import log from 'electron-log'

/**
 * Wrapper opcional de electron-updater. Solo se activa si UPDATE_FEED_URL esta seteado.
 * En desarrollo o cuando no hay feed configurado, es un no-op para evitar ruido.
 *
 * Uso:
 *   const updater = new AutoUpdaterService()
 *   updater.checkForUpdates()
 */
export class AutoUpdaterService {
  private feedUrl: string | undefined

  constructor(feedUrl: string | undefined = process.env.UPDATE_FEED_URL) {
    this.feedUrl = feedUrl
  }

  isEnabled(): boolean {
    return Boolean(this.feedUrl)
  }

  async checkForUpdates(): Promise<{ checked: boolean; reason?: string }> {
    if (!this.feedUrl) {
      return { checked: false, reason: 'UPDATE_FEED_URL not set' }
    }
    try {
      // Lazy import: electron-updater requiere electron en runtime.
      const { autoUpdater } = await import('electron-updater')
      autoUpdater.logger = log as unknown as Console
      autoUpdater.setFeedURL({ provider: 'generic', url: this.feedUrl })
      autoUpdater.on('error', (err) => log.error('[auto-updater] error', err))
      autoUpdater.on('update-available', () => log.info('[auto-updater] update available'))
      autoUpdater.on('update-downloaded', () => log.info('[auto-updater] update downloaded — will apply on quit'))
      await autoUpdater.checkForUpdatesAndNotify()
      return { checked: true }
    } catch (err) {
      log.error('[auto-updater] check failed', err)
      return { checked: false, reason: String(err) }
    }
  }
}
