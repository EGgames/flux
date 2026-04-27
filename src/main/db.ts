import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { BackupService } from './services/backupService'
import { MigrationService } from './services/migrationService'
import log from 'electron-log'

let prismaInstance: PrismaClient | null = null

/**
 * Migraciones bundleadas EN BUILD-TIME (no se leen del filesystem en runtime).
 *
 * Esto evita problemas en Windows packed donde leer dentro de `app.asar` puede
 * fallar silenciosamente (especialmente con `withFileTypes: true` + asar) y
 * dejaba la SQLite sin tablas.
 *
 * Vite resuelve este glob a un objeto `{ '/abs/.../migration.sql': '<sql contents>' }`
 * tanto en dev como en producccion. El SQL queda embebido en `out/main/index.js`.
 */
const MIGRATION_SQLS: Record<string, string> = (() => {
  try {
    // @ts-expect-error import.meta.glob es resuelto por Vite en build-time.
    const modules = import.meta.glob('../../prisma/migrations/*/migration.sql', {
      query: '?raw',
      eager: true,
      import: 'default'
    }) as Record<string, string>
    return modules
  } catch {
    return {}
  }
})()

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

function getMigrationsDir(): string {
  // Solo se usa como fallback en dev si el glob de Vite no funciono.
  return path.join(app.getAppPath(), 'prisma', 'migrations')
}

/**
 * Devuelve `[ {name, sql}, ... ]` de las migraciones embebidas en build-time,
 * ordenadas por nombre. Si no hay (no deberia pasar), cae al filesystem.
 */
function loadMigrations(): Array<{ name: string; sql: string }> {
  const inlined = Object.entries(MIGRATION_SQLS)
    .map(([key, sql]) => {
      // key tiene forma '../../prisma/migrations/<TIMESTAMP_NAME>/migration.sql'
      const parts = key.split('/')
      const name = parts[parts.length - 2]
      return { name, sql }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  if (inlined.length > 0) {
    log.info(`[db] ${inlined.length} migration(s) inlined in bundle: ${inlined.map((m) => m.name).join(', ')}`)
    return inlined
  }

  // Fallback: leer del filesystem (solo deberia pasar si el glob fallo en build).
  const dir = getMigrationsDir()
  log.warn(`[db] no inlined migrations found, falling back to filesystem at ${dir}`)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((name) => {
      const sqlPath = path.join(dir, name, 'migration.sql')
      const sql = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, 'utf-8') : ''
      return { name, sql }
    })
    .filter((m) => m.sql.length > 0)
}

/**
 * Bootstrap del schema en SQLite aplicando los `migration.sql` (embebidos en
 * el bundle JS, ver `MIGRATION_SQLS` arriba).
 *
 * Mantiene un tracker propio (`_app_migrations`) para no reaplicar dos veces
 * la misma migracion. Idempotente y tolerante a "already exists" para soportar
 * DBs creadas con versiones anteriores.
 */
async function ensureSchema(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "_app_migrations" (
       "name" TEXT PRIMARY KEY NOT NULL,
       "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  )

  const applied = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    'SELECT name FROM "_app_migrations"'
  )
  const appliedSet = new Set(applied.map((row) => row.name))

  const migrations = loadMigrations()
  if (migrations.length === 0) {
    log.error('[db] CRITICAL: no migrations available — DB will be empty')
    return
  }

  for (const { name, sql } of migrations) {
    if (appliedSet.has(name)) {
      log.info(`[db] migration ${name} already applied, skipping`)
      continue
    }

    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !/^--/.test(stmt))

    log.info(`[db] applying migration ${name} (${statements.length} statements)`)

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/already exists/i.test(msg)) {
          log.warn(`[db] skipping statement (already exists): ${msg}`)
          continue
        }
        log.error(`[db] failed to apply migration ${name}: ${msg}\nStatement: ${stmt.slice(0, 200)}`)
        throw err
      }
    }

    await prisma.$executeRawUnsafe('INSERT INTO "_app_migrations" (name) VALUES (?)', name)
    log.info(`[db] migration ${name} applied`)
  }
}

/**
 * Inicializa la DB: backup pre-arranque + bootstrap del schema (siempre) +
 * `prisma migrate deploy` (solo en dev).
 *
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
  log.info(`[db] using SQLite at ${dbPath} (packaged=${app.isPackaged})`)

  const backup = new BackupService({ dbPath, backupDir: getBackupDir() })
  try {
    const created = await backup.createBackup()
    if (created) log.info(`[db] backup created at ${created}`)
  } catch (err) {
    log.warn('[db] backup failed (continuing)', err)
  }

  // En dev: corre `prisma migrate deploy` con el binario local. En prod este
  // binario no se empaqueta y MigrationService es no-op (skip silencioso).
  if (!app.isPackaged) {
    const migrations = new MigrationService({
      dbPath,
      onMigrationFailure: async () => {
        const restored = await backup.restoreLatest()
        if (!restored) throw new Error('no backup to restore')
      }
    })
    try {
      const result = await migrations.runMigrations()
      if (result.applied) log.info('[db] migrations applied (prisma CLI)')
      if (result.restored) log.warn('[db] DB restored from backup after migration failure')
    } catch (err) {
      log.error('[db] migration step crashed', err)
    }
  }

  process.env.DATABASE_URL = `file:${dbPath}`
  prismaInstance = new PrismaClient()

  // Bootstrap del schema con SQL inline (funciona SIEMPRE, dev y prod).
  // Es la garantia de que las tablas existen antes de que IPC handlers
  // empiecen a hacer queries.
  try {
    await ensureSchema(prismaInstance)
    log.info('[db] schema ensured OK')
  } catch (err) {
    log.error('[db] ensureSchema failed', err)
    throw err
  }

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
