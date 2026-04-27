import { promises as fs } from 'fs'
import path from 'path'

export interface BackupServiceDeps {
  /** Path del archivo SQLite a respaldar (ej. userData/flux.db). */
  dbPath: string
  /** Directorio donde guardar los .bak. */
  backupDir: string
  /** Maximo de backups a conservar. */
  maxBackups?: number
  /** Inyectable para tests. */
  fsApi?: {
    copyFile: (src: string, dest: string) => Promise<void>
    mkdir: (dir: string, opts: { recursive: boolean }) => Promise<unknown>
    readdir: (dir: string) => Promise<string[]>
    unlink: (file: string) => Promise<void>
    stat: (p: string) => Promise<{ mtimeMs: number }>
    access: (p: string) => Promise<void>
  }
}

const DEFAULT_MAX = 7
const PREFIX = 'flux.db.'
const SUFFIX = '.bak'

export class BackupService {
  private readonly fsApi: NonNullable<BackupServiceDeps['fsApi']>
  private readonly maxBackups: number

  constructor(private readonly deps: BackupServiceDeps) {
    this.fsApi = deps.fsApi ?? {
      copyFile: fs.copyFile.bind(fs),
      mkdir: fs.mkdir.bind(fs),
      readdir: fs.readdir.bind(fs),
      unlink: fs.unlink.bind(fs),
      stat: fs.stat.bind(fs),
      access: fs.access.bind(fs)
    }
    this.maxBackups = deps.maxBackups ?? DEFAULT_MAX
  }

  /** Crea un backup con timestamp ISO. Si la DB no existe aun, no hace nada. */
  async createBackup(now: Date = new Date()): Promise<string | null> {
    try {
      await this.fsApi.access(this.deps.dbPath)
    } catch {
      return null
    }
    await this.fsApi.mkdir(this.deps.backupDir, { recursive: true })
    const stamp = now.toISOString().replace(/[:.]/g, '-')
    const dest = path.join(this.deps.backupDir, `${PREFIX}${stamp}${SUFFIX}`)
    await this.fsApi.copyFile(this.deps.dbPath, dest)
    await this.pruneOldBackups()
    return dest
  }

  /** Elimina los backups mas antiguos hasta dejar maxBackups. */
  async pruneOldBackups(): Promise<string[]> {
    let entries: string[]
    try {
      entries = await this.fsApi.readdir(this.deps.backupDir)
    } catch {
      return []
    }
    const candidates = entries.filter((n) => n.startsWith(PREFIX) && n.endsWith(SUFFIX))
    if (candidates.length <= this.maxBackups) return []

    const withMtime = await Promise.all(
      candidates.map(async (name) => {
        const full = path.join(this.deps.backupDir, name)
        const st = await this.fsApi.stat(full)
        return { name, full, mtimeMs: st.mtimeMs }
      })
    )
    withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs)
    const toDelete = withMtime.slice(this.maxBackups)
    for (const f of toDelete) {
      await this.fsApi.unlink(f.full).catch(() => {})
    }
    return toDelete.map((f) => f.full)
  }

  /** Devuelve el path del backup mas reciente, o null si no hay. */
  async findLatestBackup(): Promise<string | null> {
    let entries: string[]
    try {
      entries = await this.fsApi.readdir(this.deps.backupDir)
    } catch {
      return null
    }
    const candidates = entries.filter((n) => n.startsWith(PREFIX) && n.endsWith(SUFFIX))
    if (candidates.length === 0) return null
    const withMtime = await Promise.all(
      candidates.map(async (name) => {
        const full = path.join(this.deps.backupDir, name)
        const st = await this.fsApi.stat(full)
        return { full, mtimeMs: st.mtimeMs }
      })
    )
    withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs)
    return withMtime[0].full
  }

  /** Restaura el backup mas reciente sobre dbPath. Devuelve true si restauro. */
  async restoreLatest(): Promise<boolean> {
    const latest = await this.findLatestBackup()
    if (!latest) return false
    await this.fsApi.copyFile(latest, this.deps.dbPath)
    return true
  }
}
