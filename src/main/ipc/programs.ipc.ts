import { ipcMain } from 'electron'
import type { DbClient } from '../db/types'

export function registerProgramIpc(db: DbClient): void {
  ipcMain.handle('program:list', async (_event, profileId: string) => {
    return db.radioProgram.findMany({
      where: { profileId },
      include: { playlist: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
    })
  })

  ipcMain.handle(
    'program:create',
    async (
      _event,
      data: {
        profileId: string
        name: string
        dayOfWeek: number
        startTime: string
        endTime: string
        playlistId?: string
        priority?: number
      }
    ) => {
      // Detect time overlap with existing programs on same day
      const overlapping = await db.radioProgram.findFirst({
        where: {
          profileId: data.profileId,
          dayOfWeek: data.dayOfWeek,
          enabled: true,
          AND: [
            { startTime: { lte: data.endTime } },
            { endTime: { gte: data.startTime } }
          ]
        }
      })
      if (overlapping) {
        throw new Error(
          `Conflicto de horario con el programa "${overlapping.name}" (${overlapping.startTime}–${overlapping.endTime})`
        )
      }
      return db.radioProgram.create({ data })
    }
  )

  ipcMain.handle(
    'program:update',
    async (
      _event,
      id: string,
      data: {
        name?: string
        dayOfWeek?: number
        startTime?: string
        endTime?: string
        playlistId?: string | null
        priority?: number
        enabled?: boolean
      }
    ) => {
      return db.radioProgram.update({ where: { id }, data })
    }
  )

  ipcMain.handle('program:delete', async (_event, id: string) => {
    await db.radioProgram.delete({ where: { id } })
    return { success: true }
  })
}
