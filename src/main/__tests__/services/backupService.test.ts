import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BackupService } from '../../services/backupService'

interface FakeFs {
  files: Map<string, { mtimeMs: number }>
  copyFile: ReturnType<typeof vi.fn>
  mkdir: ReturnType<typeof vi.fn>
  readdir: ReturnType<typeof vi.fn>
  unlink: ReturnType<typeof vi.fn>
  stat: ReturnType<typeof vi.fn>
  access: ReturnType<typeof vi.fn>
}

function makeFs(initial: string[] = []): FakeFs {
  const files = new Map<string, { mtimeMs: number }>()
  const norm = (p: string): string => p.replace(/\\/g, '/')
  for (const f of initial) files.set(norm(f), { mtimeMs: Date.now() })
  return {
    files,
    copyFile: vi.fn(async (_src: string, dest: string) => {
      files.set(norm(dest), { mtimeMs: Date.now() })
    }),
    mkdir: vi.fn(async () => undefined),
    readdir: vi.fn(async (dir: string) => {
      const d = norm(dir)
      return Array.from(files.keys())
        .filter((p) => p.startsWith(d + '/'))
        .map((p) => p.slice(d.length + 1))
    }),
    unlink: vi.fn(async (file: string) => { files.delete(norm(file)) }),
    stat: vi.fn(async (p: string) => {
      const f = files.get(norm(p))
      if (!f) throw new Error('ENOENT')
      return f
    }),
    access: vi.fn(async (p: string) => {
      if (!files.has(norm(p))) throw new Error('ENOENT')
    })
  }
}

describe('BackupService', () => {
  const dbPath = '/data/flux.db'
  const backupDir = '/data/backups'
  let fsApi: FakeFs

  beforeEach(() => {
    fsApi = makeFs([dbPath])
  })

  describe('createBackup', () => {
    it('returns null if db file does not exist', async () => {
      fsApi = makeFs([])
      const svc = new BackupService({ dbPath, backupDir, fsApi })
      const result = await svc.createBackup()
      expect(result).toBeNull()
      expect(fsApi.copyFile).not.toHaveBeenCalled()
    })

    it('creates a backup with timestamp and ensures dir exists', async () => {
      const svc = new BackupService({ dbPath, backupDir, fsApi })
      const fixedNow = new Date('2026-04-26T10:00:00.000Z')
      const created = await svc.createBackup(fixedNow)
      expect(created).toContain('flux.db.2026-04-26T10-00-00-000Z.bak')
      expect(fsApi.mkdir).toHaveBeenCalledWith(backupDir, { recursive: true })
      expect(fsApi.copyFile).toHaveBeenCalledWith(dbPath, created)
    })

    it('prunes old backups when over maxBackups', async () => {
      // pre-poblar 8 backups con mtime crecientes
      const initialFiles = Array.from({ length: 8 }, (_, i) => `${backupDir}/flux.db.2026-04-26T10-00-0${i}-000Z.bak`)
      fsApi = makeFs([dbPath, ...initialFiles])
      // ajustar mtimes para que tengan orden definido (mas grande = mas reciente)
      initialFiles.forEach((f, i) => fsApi.files.set(f, { mtimeMs: 1000 + i }))

      const svc = new BackupService({ dbPath, backupDir, fsApi, maxBackups: 3 })
      await svc.createBackup(new Date('2026-04-26T11:00:00.000Z'))

      // tras crear el nuevo (que tiene mtime maximo), deberia haber exactamente 3 archivos
      const remaining = Array.from(fsApi.files.keys()).filter((f) => f.includes('.bak'))
      expect(remaining.length).toBe(3)
      expect(fsApi.unlink).toHaveBeenCalled()
    })
  })

  describe('findLatestBackup', () => {
    it('returns null when no backups exist', async () => {
      const svc = new BackupService({ dbPath, backupDir, fsApi })
      const result = await svc.findLatestBackup()
      expect(result).toBeNull()
    })

    it('returns the most recent backup by mtime', async () => {
      const old = `${backupDir}/flux.db.2026-04-25T10-00-00-000Z.bak`
      const recent = `${backupDir}/flux.db.2026-04-26T10-00-00-000Z.bak`
      fsApi = makeFs([dbPath, old, recent])
      fsApi.files.set(old.replace(/\\/g, '/'), { mtimeMs: 100 })
      fsApi.files.set(recent.replace(/\\/g, '/'), { mtimeMs: 200 })

      const svc = new BackupService({ dbPath, backupDir, fsApi })
      const result = await svc.findLatestBackup()
      expect(result?.replace(/\\/g, '/')).toBe(recent)
    })
  })

  describe('restoreLatest', () => {
    it('returns false if no backup found', async () => {
      const svc = new BackupService({ dbPath, backupDir, fsApi })
      const result = await svc.restoreLatest()
      expect(result).toBe(false)
      expect(fsApi.copyFile).not.toHaveBeenCalled()
    })

    it('copies the latest backup over dbPath', async () => {
      const recent = `${backupDir}/flux.db.2026-04-26T10-00-00-000Z.bak`
      fsApi = makeFs([dbPath, recent])
      fsApi.files.set(recent.replace(/\\/g, '/'), { mtimeMs: 200 })

      const svc = new BackupService({ dbPath, backupDir, fsApi })
      const result = await svc.restoreLatest()
      expect(result).toBe(true)
      expect(fsApi.copyFile).toHaveBeenCalled()
      const args = fsApi.copyFile.mock.calls[0]
      expect((args[0] as string).replace(/\\/g, '/')).toBe(recent)
      expect(args[1]).toBe(dbPath)
    })
  })
})
