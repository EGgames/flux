import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { BackupService } from './services/backupService'
import { MigrationService } from './services/migrationService'
import log from 'electron-log'

let prismaInstance: PrismaClient | null = null

function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'flux.db')
}

function getBackupDir(): string {
  return path.join(app.getPath('userData'), 'backups')
}

/**
 * Inicializa la DB: backup pre-arranque + migrate deploy + cliente Prisma.
 * Idempotente: en el segundo llamado solo devuelve el cliente.
 */
export async function initDb(): Promise<PrismaClient> {
  if (prismaInstance) return prismaInstance

  const dbPath = getDatabasePath()
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const backup = new BackupService({ dbPath, backupDir: getBackupDir() })
  try {
    const created = await backup.createBackup()
    if (created) log.info(`[db] backup created at ${created}`)
  } catch (err) {
    log.warn('[db] backup failed (continuing)', err)
  }

  const migrations = new MigrationService({
    dbPath,
    onMigrationFailure: async () => {
      const restored = await backup.restoreLatest()
      if (!restored) throw new Error('no backup to restore')
    }
  })
  try {
    const result = await migrations.runMigrations()
    if (result.applied) log.info('[db] migrations applied')
    if (result.restored) log.warn('[db] DB restored from backup after migration failure')
  } catch (err) {
    log.error('[db] migration step crashed', err)
  }

  process.env.DATABASE_URL = `file:${dbPath}`
  prismaInstance = new PrismaClient()
  return prismaInstance
}

export function getDb(): PrismaClient {
  if (!prismaInstance) {
    const dbPath = getDatabasePath()
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    process.env.DATABASE_URL = `file:${dbPath}`
    prismaInstance = new PrismaClient()
  }
  return prismaInstance
}

export async function closeDb(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect()
    prismaInstance = null
  }
}
