import log from 'electron-log'
import { app } from 'electron'
import path from 'path'

let installed = false

/**
 * Configura electron-log con rotacion y registra handlers globales para
 * uncaughtException y unhandledRejection. Idempotente.
 */
export function installLogger(): void {
  if (installed) return
  installed = true

  // electron-log v5 escribe por defecto en userData/logs/main.log; lo dejamos explicito.
  const logDir = path.join(app.getPath('userData'), 'logs')
  log.transports.file.resolvePathFn = () => path.join(logDir, 'flux.log')
  // 10 MB por archivo, 5 archivos retenidos.
  log.transports.file.maxSize = 10 * 1024 * 1024
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
  log.transports.console.level = process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
  log.transports.file.level = 'info'

  process.on('uncaughtException', (err) => {
    log.error('[uncaughtException]', err)
  })
  process.on('unhandledRejection', (reason) => {
    log.error('[unhandledRejection]', reason)
  })

  log.info(`Logger initialized. File: ${path.join(logDir, 'flux.log')}`)
}

/**
 * Path absoluto del log activo. Util para mostrarlo en "Acerca de" o en runbook.
 */
export function getLogFilePath(): string {
  return path.join(app.getPath('userData'), 'logs', 'flux.log')
}

export { log }
