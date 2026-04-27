import { spawn } from 'child_process'
import path from 'path'
import { promises as fs } from 'fs'
import log from 'electron-log'

export interface MigrationServiceDeps {
  dbPath: string
  /** Path al binario prisma (en dev: node_modules/.bin/prisma). En prod la migracion ya esta aplicada por el instalador. */
  prismaBin?: string
  /** Working directory donde vive el schema.prisma. */
  cwd?: string
  /** Inyectable para tests: corre el comando y devuelve {code, stdout, stderr}. */
  runner?: (cmd: string, args: string[], env: NodeJS.ProcessEnv, cwd: string) => Promise<{ code: number; stdout: string; stderr: string }>
  /** Inyectable para tests: chequea presencia del binario prisma. */
  binCheck?: (binPath: string) => Promise<boolean>
  /** Hook para restaurar backup en caso de fallo de migracion. */
  onMigrationFailure?: () => Promise<void>
}

const defaultRunner: NonNullable<MigrationServiceDeps['runner']> = (cmd, args, env, cwd) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { env, cwd, shell: process.platform === 'win32' })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => (stdout += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })

export class MigrationService {
  constructor(private readonly deps: MigrationServiceDeps) {}

  async runMigrations(): Promise<{ applied: boolean; restored: boolean }> {
    const cwd = this.deps.cwd ?? process.cwd()
    const prismaBin = this.deps.prismaBin ?? path.join('node_modules', '.bin', 'prisma')
    const runner = this.deps.runner ?? defaultRunner
    const binCheck = this.deps.binCheck ?? (async (p: string) => {
      try { await fs.access(p); return true } catch { return false }
    })

    // Verificamos que existe el binario; en producción Electron-builder no lo bundlea por default
    // por lo que las migraciones deben aplicarse en build-time. Si el binario no esta, no es error.
    const exists = await binCheck(path.join(cwd, prismaBin))
    if (!exists) {
      log.info('[migrations] prisma CLI not available — skipping (production build)')
      return { applied: false, restored: false }
    }

    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: `file:${this.deps.dbPath}` }
    log.info('[migrations] running prisma migrate deploy')
    const res = await runner(prismaBin, ['migrate', 'deploy'], env, cwd)
    if (res.code === 0) {
      log.info('[migrations] applied successfully')
      return { applied: true, restored: false }
    }

    log.error(`[migrations] failed (code=${res.code}): ${res.stderr || res.stdout}`)
    if (this.deps.onMigrationFailure) {
      try {
        await this.deps.onMigrationFailure()
        log.warn('[migrations] backup restored after failure')
        return { applied: false, restored: true }
      } catch (err) {
        log.error('[migrations] backup restore also failed', err)
      }
    }
    return { applied: false, restored: false }
  }
}
