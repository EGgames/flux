import { describe, it, expect, vi } from 'vitest'

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { MigrationService } from '../../services/migrationService'

describe('MigrationService.runMigrations', () => {
  it('skips when prisma binary is not present', async () => {
    const svc = new MigrationService({
      dbPath: '/x/flux.db',
      cwd: '/nope',
      prismaBin: 'node_modules/.bin/prisma',
      binCheck: async () => false
    })
    const result = await svc.runMigrations()
    expect(result.applied).toBe(false)
    expect(result.restored).toBe(false)
  })

  it('returns applied=true when runner returns code 0', async () => {
    const runner = vi.fn().mockResolvedValue({ code: 0, stdout: 'ok', stderr: '' })
    const svc = new MigrationService({
      dbPath: '/x/flux.db',
      cwd: '/repo',
      runner,
      binCheck: async () => true
    })
    const result = await svc.runMigrations()
    expect(result.applied).toBe(true)
    expect(runner).toHaveBeenCalled()
  })

  it('triggers onMigrationFailure when runner returns non-zero', async () => {
    const runner = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'boom' })
    const onMigrationFailure = vi.fn().mockResolvedValue(undefined)
    const svc = new MigrationService({
      dbPath: '/x/flux.db',
      cwd: '/repo',
      runner,
      binCheck: async () => true,
      onMigrationFailure
    })
    const result = await svc.runMigrations()
    expect(onMigrationFailure).toHaveBeenCalled()
    expect(result.applied).toBe(false)
    expect(result.restored).toBe(true)
  })

  it('logs and returns restored=false when restore also fails', async () => {
    const runner = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'boom' })
    const onMigrationFailure = vi.fn().mockRejectedValue(new Error('no backup'))
    const svc = new MigrationService({
      dbPath: '/x/flux.db',
      cwd: '/repo',
      runner,
      binCheck: async () => true,
      onMigrationFailure
    })
    const result = await svc.runMigrations()
    expect(result.applied).toBe(false)
    expect(result.restored).toBe(false)
  })
})
