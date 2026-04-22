import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'

export function registerProfileIpc(db: PrismaClient): void {
  ipcMain.handle('profile:list', async () => {
    return db.profile.findMany({ orderBy: { createdAt: 'asc' } })
  })

  ipcMain.handle('profile:create', async (_event, data: { name: string }) => {
    const existing = await db.profile.findUnique({ where: { name: data.name } })
    if (existing) {
      throw new Error(`Ya existe un perfil con el nombre "${data.name}"`)
    }
    return db.profile.create({ data: { name: data.name } })
  })

  ipcMain.handle(
    'profile:update',
    async (_event, id: string, data: { name?: string; isDefault?: boolean; preferences?: string }) => {
      if (data.isDefault) {
        await db.profile.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      }
      return db.profile.update({ where: { id }, data })
    }
  )

  ipcMain.handle('profile:delete', async (_event, id: string) => {
    const profile = await db.profile.findUnique({ where: { id } })
    if (profile?.isDefault) {
      throw new Error('No se puede eliminar el perfil predeterminado')
    }
    await db.profile.delete({ where: { id } })
    return { success: true }
  })

  ipcMain.handle('profile:select', async (_event, id: string) => {
    await db.profile.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
    return db.profile.update({ where: { id }, data: { isDefault: true } })
  })
}
