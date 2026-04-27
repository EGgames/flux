import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { BackupService } from './services/backupService'
import { MigrationService } from './services/migrationService'
import log from 'electron-log'

let prismaInstance: PrismaClient | null = null

/**
 * En produccion (app empaquetada) el cliente generado .prisma/client vive en
 * `process.resourcesPath/.prisma/client/` (extraResources), no en el asar.
 * Apuntamos a Prisma al .node nativo y al schema antes de instanciar el cliente.
 * En dev (app.isPackaged === false) los paths default funcionan.
 */
function configurePrismaForProduction(): void {
  if (!app.isPackaged) return
  // El cliente Prisma generado vive en app.asar.unpacked/node_modules/.prisma/client/
  // (copiado via extraResources). El launcher de produccion (out/main/launcher.js)
  // ajusta NODE_PATH para que `require('.prisma/client/default')` resuelva ahi.
  // Aqui solo apuntamos las rutas explicitas como fallback / para Prisma 5.x.
  const baseDir = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '.prisma', 'client')
  const enginePath = path.join(baseDir, 'query_engine-windows.dll.node')
  const schemaPath = path.join(baseDir, 'schema.prisma')
  if (fs.existsSync(enginePath)) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath
  } else {
    log.warn(`[db] prisma engine not found at ${enginePath}`)
  }
  if (fs.existsSync(schemaPath)) {
    process.env.PRISMA_SCHEMA_PATH = schemaPath
  }
}

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

  configurePrismaForProduction()

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
    configurePrismaForProduction()
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
