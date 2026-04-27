import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import log from 'electron-log'
import { BackupService } from './services/backupService'
import { createFacade, Repository } from './db/repository'

/**
 * Schema SQL completo embebido en build-time (Vite `?raw`). Contiene los
 * `CREATE TABLE IF NOT EXISTS` para todas las tablas. Se aplica de manera
 * idempotente al iniciar la app, sin depender del filesystem en runtime.
 */
// @ts-expect-error vite raw import
import SCHEMA_SQL from './db/schema.sql?raw'

export type DbFacade = Record<string, Repository>

let dbInstance: Database.Database | null = null
let facadeInstance: DbFacade | null = null

function getDatabasePath(): string {
  return path.join(app.getPath('userData'), 'flux.db')
}

function getBackupDir(): string {
  return path.join(app.getPath('userData'), 'backups')
}

/**
 * Aplica el schema SQL embebido. better-sqlite3 ejecuta multiples statements
 * separados por `;` con `db.exec()`. El SQL usa `IF NOT EXISTS` en todas las
 * tablas e indices para ser totalmente idempotente.
 */
function ensureSchema(db: Database.Database): void {
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  log.info('[db] applying schema (idempotent CREATE IF NOT EXISTS)')
  try {
    db.exec(SCHEMA_SQL)
    log.info('[db] schema OK')
  } catch (err) {
    log.error('[db] schema failed', err)
    throw err
  }
}

/**
 * Inicializa la DB: backup + open + schema + facade. Idempotente.
 */
export async function initDb(): Promise<DbFacade> {
  if (facadeInstance) return facadeInstance

  const dbPath = getDatabasePath()
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  log.info(`[db] sqlite at ${dbPath} (packaged=${app.isPackaged})`)

  const backup = new BackupService({ dbPath, backupDir: getBackupDir() })
  try {
    const created = await backup.createBackup()
    if (created) log.info(`[db] backup created at ${created}`)
  } catch (err) {
    log.warn('[db] backup failed (continuing)', err)
  }

  try {
    dbInstance = new Database(dbPath)
  } catch (err) {
    log.error(`[db] failed to open sqlite at ${dbPath}`, err)
    throw err
  }

  ensureSchema(dbInstance)

  facadeInstance = createFacade(dbInstance)
  log.info(`[db] facade ready with ${Object.keys(facadeInstance).length} models`)
  return facadeInstance
}

/** Cierra la conexion (llamado en app:before-quit). */
export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close()
    } catch (err) {
      log.warn('[db] close error', err)
    }
    dbInstance = null
    facadeInstance = null
  }
}
