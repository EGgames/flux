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

function getMigrationsDir(): string {
  // electron-builder bundlea `prisma/migrations/**` dentro de app.asar.
  // `app.getAppPath()` devuelve la raiz de asar en produccion y la del proyecto en dev.
  return path.join(app.getAppPath(), 'prisma', 'migrations')
}

/**
 * Bootstrap del schema en SQLite leyendo los `migration.sql` bundleados.
 *
 * Esto es el fallback que permite al instalador funcionar en cualquier PC sin
 * depender del binario `prisma` (que NO se empaqueta). Mantenemos un tracker
 * propio (`_app_migrations`) para no reaplicar dos veces la misma migration.
 *
 * Es idempotente: si las tablas ya existen (DB legacy creada antes del tracker),
 * se ignoran los errores de "already exists" y solo se registran como aplicadas.
 */
async function ensureSchema(prisma: PrismaClient): Promise<void> {
  const migrationsDir = getMigrationsDir()
  if (!fs.existsSync(migrationsDir)) {
    log.warn('[db] migrations directory not found at', migrationsDir)
    return
  }

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

  const migrationDirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  for (const dir of migrationDirs) {
    if (appliedSet.has(dir)) continue

    const sqlPath = path.join(migrationsDir, dir, 'migration.sql')
    if (!fs.existsSync(sqlPath)) continue

    const sqlContent = fs.readFileSync(sqlPath, 'utf-8')
    const statements = sqlContent
      .split(/;\s*(?:\r?\n|$)/)
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !/^--/.test(stmt))

    log.info(`[db] applying migration ${dir} (${statements.length} statements)`)

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/already exists/i.test(msg)) {
          log.warn(`[db] skipping statement (already exists): ${msg}`)
          continue
        }
        log.error(`[db] failed to apply migration ${dir}:`, msg)
        throw err
      }
    }

    await prisma.$executeRawUnsafe('INSERT INTO "_app_migrations" (name) VALUES (?)', dir)
    log.info(`[db] migration ${dir} applied`)
  }
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

  // Bootstrap del schema: aplica los migration.sql bundleados si las tablas
  // aun no existen. Imprescindible en producccion donde el binario `prisma`
  // no se empaqueta y `MigrationService` no puede ejecutar `migrate deploy`.
  try {
    await ensureSchema(prismaInstance)
  } catch (err) {
    log.error('[db] ensureSchema failed', err)
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
