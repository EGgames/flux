import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { validatedHandle } from '../utils/ipcValidation'

const profileIdSchema = z.string().min(1)
const idSchema = z.string().min(1)

export function registerPlaylistIpc(db: PrismaClient): void {
  ipcMain.handle('playlist:list', async (_event, profileId: string) => {
    return db.playlist.findMany({
      where: { profileId },
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' }
    })
  })

  ipcMain.handle('playlist:get-with-items', async (_event, id: string) => {
    return db.playlist.findUnique({
      where: { id },
      include: {
        items: {
          include: { audioAsset: true },
          orderBy: { position: 'asc' }
        }
      }
    })
  })

  // Ejemplo de validacion Zod en IPC: el payload debe tener name no-vacio y profileId.
  validatedHandle(
    'playlist:create',
    z.object({ name: z.string().min(1, 'name no puede estar vacio'), profileId: profileIdSchema }),
    async (_event, data) => db.playlist.create({ data })
  )

  ipcMain.handle(
    'playlist:update',
    async (_event, id: string, data: { name?: string; enabled?: boolean }) => {
      return db.playlist.update({ where: { id }, data })
    }
  )

  ipcMain.handle('playlist:delete', async (_event, id: string) => {
    await db.playlist.delete({ where: { id } })
    return { success: true }
  })

  ipcMain.handle(
    'playlist:add-item',
    async (_event, playlistId: string, audioAssetId: string, position: number) => {
      return db.playlistItem.create({ data: { playlistId, audioAssetId, position } })
    }
  )

  ipcMain.handle('playlist:remove-item', async (_event, itemId: string) => {
    await db.playlistItem.delete({ where: { id: itemId } })
    return { success: true }
  })

  ipcMain.handle('playlist:reorder', async (_event, playlistId: string, itemIds: string[]) => {
    // Validate that all items belong to the given playlist before reordering
    const items = await db.playlistItem.findMany({
      where: { id: { in: itemIds }, playlistId },
      select: { id: true }
    })
    if (items.length !== itemIds.length) {
      throw new Error('Algunos items no pertenecen a la playlist indicada')
    }
    for (let i = 0; i < itemIds.length; i++) {
      await db.playlistItem.update({
        where: { id: itemIds[i] },
        data: { position: i }
      })
    }
    return { success: true }
  })

  // marcador: idSchema reservada para futuros validadores granulares
  void idSchema
}
