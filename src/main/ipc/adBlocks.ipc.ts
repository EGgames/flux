import { ipcMain } from 'electron'
import type { DbClient } from '../db/types'

export function registerAdBlockIpc(db: DbClient): void {
  ipcMain.handle('ad-block:list', async (_event, profileId: string) => {
    return db.adBlock.findMany({
      where: { profileId },
      include: {
        _count: { select: { items: true } },
        rules: { where: { enabled: true } }
      },
      orderBy: { name: 'asc' }
    })
  })

  ipcMain.handle('ad-block:get-with-items', async (_event, id: string) => {
    return db.adBlock.findUnique({
      where: { id },
      include: {
        items: {
          include: { audioAsset: true },
          orderBy: { position: 'asc' }
        },
        rules: true
      }
    })
  })

  ipcMain.handle('ad-block:create', async (_event, data: { name: string; profileId: string }) => {
    return db.adBlock.create({ data })
  })

  ipcMain.handle(
    'ad-block:update',
    async (_event, id: string, data: { name?: string; enabled?: boolean }) => {
      return db.adBlock.update({ where: { id }, data })
    }
  )

  ipcMain.handle('ad-block:delete', async (_event, id: string) => {
    await db.adBlock.delete({ where: { id } })
    return { success: true }
  })

  ipcMain.handle(
    'ad-block:add-item',
    async (_event, adBlockId: string, audioAssetId: string, position: number) => {
      return db.adBlockItem.create({ data: { adBlockId, audioAssetId, position } })
    }
  )

  ipcMain.handle('ad-block:remove-item', async (_event, itemId: string) => {
    await db.adBlockItem.delete({ where: { id: itemId } })
    return { success: true }
  })

  // Manual trigger — emits event handled by playout IPC
  ipcMain.handle('ad-block:trigger', async (_event, id: string) => {
    const block = await db.adBlock.findUnique({
      where: { id },
      include: {
        items: {
          include: { audioAsset: true },
          orderBy: { position: 'asc' }
        }
      }
    })
    if (!block) throw new Error('Tanda no encontrada')
    return block
  })

  // Ad Rules
  ipcMain.handle('ad-rule:list', async (_event, profileId: string) => {
    return db.adRule.findMany({
      where: { profileId },
      include: { adBlock: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
    })
  })

  ipcMain.handle(
    'ad-rule:create',
    async (
      _event,
      data: {
        profileId: string
        adBlockId: string
        triggerType: string
        triggerConfig: string
        priority: number
      }
    ) => {
      if (!data.profileId || !data.adBlockId || !data.triggerType) {
        throw new Error('profileId, adBlockId y triggerType son obligatorios')
      }

      if (data.triggerType === 'time') {
        const existing = await db.adRule.findFirst({
          where: {
            adBlockId: data.adBlockId,
            triggerType: 'time',
            triggerConfig: data.triggerConfig,
            enabled: true
          }
        })
        if (existing) {
          throw new Error('Ese horario ya existe para la tanda seleccionada')
        }
      }

      return db.adRule.create({ data })
    }
  )

  ipcMain.handle(
    'ad-rule:update',
    async (
      _event,
      id: string,
      data: { triggerConfig?: string; priority?: number; enabled?: boolean }
    ) => {
      return db.adRule.update({ where: { id }, data })
    }
  )

  ipcMain.handle('ad-rule:delete', async (_event, id: string) => {
    await db.adRule.delete({ where: { id } })
    return { success: true }
  })
}
