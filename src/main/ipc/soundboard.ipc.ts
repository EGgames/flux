import { ipcMain } from 'electron'
import type { DbClient } from '../db/types'

const TOTAL_SLOTS = 16

export function registerSoundboardIpc(db: DbClient): void {
  ipcMain.handle('soundboard:get', async (_event, profileId: string) => {
    const existing = await db.soundboardButton.findMany({
      where: { profileId },
      include: { audioAsset: true }
    })

    // Return full 16-slot grid, filling missing slots with nulls
    const grid = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
      const btn = existing.find((b) => b.slotIndex === i + 1)
      return (
        btn ?? {
          id: null,
          profileId,
          slotIndex: i + 1,
          label: null,
          audioAssetId: null,
          audioAsset: null,
          mode: 'oneshot',
          color: '#3a7bd5'
        }
      )
    })
    return grid
  })

  ipcMain.handle(
    'soundboard:assign',
    async (
      _event,
      profileId: string,
      slotIndex: number,
      data: {
        audioAssetId?: string | null
        label?: string
        mode?: string
        color?: string
      }
    ) => {
      if (slotIndex < 1 || slotIndex > TOTAL_SLOTS) {
        throw new Error(`Slot inválido. Debe estar entre 1 y ${TOTAL_SLOTS}`)
      }
      return db.soundboardButton.upsert({
        where: { profileId_slotIndex: { profileId, slotIndex } },
        update: data,
        create: { profileId, slotIndex, ...data }
      })
    }
  )

  ipcMain.handle('soundboard:trigger', async (_event, profileId: string, slotIndex: number) => {
    const button = await db.soundboardButton.findUnique({
      where: { profileId_slotIndex: { profileId, slotIndex } },
      include: { audioAsset: true }
    })
    if (!button || !button.audioAsset) {
      throw new Error(`El botón ${slotIndex} no tiene audio asignado`)
    }
    return {
      slotIndex,
      mode: button.mode,
      audioAsset: button.audioAsset
    }
  })
}
