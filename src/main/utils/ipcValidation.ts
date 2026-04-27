import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { ZodTypeAny, z } from 'zod'
import log from 'electron-log'

/**
 * Wrapper de ipcMain.handle que valida los args con un schema Zod antes de
 * ejecutar el handler. Si la validacion falla, rechaza con un Error descriptivo
 * y loguea sin tirar la app.
 *
 * Uso:
 *   validatedHandle('playlist:create', z.object({ name: z.string().min(1), profileId: z.string() }),
 *     async (_event, data) => db.playlist.create({ data }))
 */
export function validatedHandle<S extends ZodTypeAny>(
  channel: string,
  schema: S,
  handler: (event: IpcMainInvokeEvent, payload: z.infer<S>) => unknown | Promise<unknown>
): void {
  ipcMain.handle(channel, async (event, raw: unknown) => {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')
      const message = `IPC validation failed [${channel}]: ${issues}`
      log.warn(message, { raw })
      throw new Error(message)
    }
    return handler(event, parsed.data)
  })
}
