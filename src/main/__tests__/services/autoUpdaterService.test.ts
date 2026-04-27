import { describe, it, expect, vi } from 'vitest'

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { AutoUpdaterService } from '../../services/autoUpdaterService'

describe('AutoUpdaterService', () => {
  it('isEnabled returns false when feed url is not set', () => {
    const svc = new AutoUpdaterService(undefined)
    expect(svc.isEnabled()).toBe(false)
  })

  it('isEnabled returns true when feed url is set', () => {
    const svc = new AutoUpdaterService('https://updates.example.com')
    expect(svc.isEnabled()).toBe(true)
  })

  it('checkForUpdates short-circuits without feed url', async () => {
    const svc = new AutoUpdaterService(undefined)
    const r = await svc.checkForUpdates()
    expect(r.checked).toBe(false)
    expect(r.reason).toContain('UPDATE_FEED_URL')
  })
})
