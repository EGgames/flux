import { ipcMain } from 'electron'
import type { DbClient } from '../db/types'
import type { StreamingService } from '../services/streamingService'

export function registerOutputIpc(db: DbClient, streamingService: StreamingService): void {
  ipcMain.handle('output:list', async (_event, profileId: string) => {
    return db.outputIntegration.findMany({
      where: { profileId },
      orderBy: { outputType: 'asc' }
    })
  })

  ipcMain.handle(
    'output:save',
    async (
      _event,
      data: {
        profileId: string
        outputType: string
        config: string
        enabled?: boolean
      }
    ) => {
      // One entry per outputType per profile (upsert)
      const existing = await db.outputIntegration.findFirst({
        where: { profileId: data.profileId, outputType: data.outputType }
      })
      if (existing) {
        return db.outputIntegration.update({
          where: { id: existing.id },
          data: { config: data.config, enabled: data.enabled ?? existing.enabled }
        })
      }
      return db.outputIntegration.create({ data })
    }
  )

  ipcMain.handle('output:delete', async (_event, id: string) => {
    await db.outputIntegration.delete({ where: { id } })
    return { success: true }
  })

  ipcMain.handle('output:toggle', async (_event, id: string, enabled: boolean) => {
    const output = await db.outputIntegration.update({
      where: { id },
      data: { enabled }
    })
    if (!enabled && output.outputType !== 'local') {
      streamingService.disconnect(id)
    }
    return output
  })

  ipcMain.handle('output:test', async (_event, id: string) => {
    const output = await db.outputIntegration.findUnique({ where: { id } })
    if (!output) throw new Error('Integración no encontrada')
    if (output.outputType === 'local') {
      return { success: true, message: 'Tarjeta de sonido local configurada' }
    }
    const config = JSON.parse(output.config)
    return streamingService.testConnection(output.outputType, config)
  })
}
