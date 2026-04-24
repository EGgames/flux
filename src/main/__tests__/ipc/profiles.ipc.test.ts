import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

import { registerProfileIpc } from '../../ipc/profiles.ipc'
import type { PrismaClient } from '@prisma/client'
import { ipcMain } from 'electron'
import { getRegisteredHandlers, invokeHandler, createDbMock } from '../helpers/ipcHarness'

describe('profiles.ipc', () => {
  let db: ReturnType<typeof createDbMock>
  let handlers: Map<string, (...args: unknown[]) => unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ipcMain.handle as ReturnType<typeof vi.fn>).mockClear()
    db = createDbMock()
    registerProfileIpc(db as unknown as PrismaClient)
    handlers = getRegisteredHandlers()
  })

  it('registers all expected handlers', () => {
    for (const ch of ['profile:list', 'profile:create', 'profile:update', 'profile:delete', 'profile:select']) {
      expect(handlers.has(ch)).toBe(true)
    }
  })

  describe('profile:list', () => {
    it('returns profiles ordered by createdAt asc', async () => {
      const profiles = [{ id: 'p1', name: 'A' }]
      db.profile.findMany.mockResolvedValue(profiles)

      const result = await invokeHandler(handlers, 'profile:list')

      expect(db.profile.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' } })
      expect(result).toEqual(profiles)
    })
  })

  describe('profile:create', () => {
    it('creates a new profile when name is unique', async () => {
      db.profile.findUnique.mockResolvedValue(null)
      db.profile.create.mockResolvedValue({ id: 'p1', name: 'New' })

      const result = await invokeHandler(handlers, 'profile:create', { name: 'New' })

      expect(db.profile.create).toHaveBeenCalledWith({ data: { name: 'New' } })
      expect(result).toEqual({ id: 'p1', name: 'New' })
    })

    it('throws when name already exists', async () => {
      db.profile.findUnique.mockResolvedValue({ id: 'existing', name: 'Dup' })

      await expect(invokeHandler(handlers, 'profile:create', { name: 'Dup' })).rejects.toThrow(
        'Ya existe un perfil con el nombre "Dup"'
      )
      expect(db.profile.create).not.toHaveBeenCalled()
    })
  })

  describe('profile:update', () => {
    it('clears other defaults when isDefault=true', async () => {
      db.profile.update.mockResolvedValue({ id: 'p1', isDefault: true })

      await invokeHandler(handlers, 'profile:update', 'p1', { isDefault: true })

      expect(db.profile.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false }
      })
      expect(db.profile.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isDefault: true }
      })
    })

    it('does NOT clear defaults when isDefault is not set', async () => {
      db.profile.update.mockResolvedValue({ id: 'p1' })

      await invokeHandler(handlers, 'profile:update', 'p1', { name: 'Renamed' })

      expect(db.profile.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('profile:delete', () => {
    it('deletes a non-default profile', async () => {
      db.profile.findUnique.mockResolvedValue({ id: 'p1', isDefault: false })
      db.profile.delete.mockResolvedValue({ id: 'p1' })

      const result = await invokeHandler(handlers, 'profile:delete', 'p1')

      expect(db.profile.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
      expect(result).toEqual({ success: true })
    })

    it('throws when trying to delete the default profile', async () => {
      db.profile.findUnique.mockResolvedValue({ id: 'p1', isDefault: true })

      await expect(invokeHandler(handlers, 'profile:delete', 'p1')).rejects.toThrow(
        'No se puede eliminar el perfil predeterminado'
      )
      expect(db.profile.delete).not.toHaveBeenCalled()
    })
  })

  describe('profile:select', () => {
    it('clears all defaults then sets selected as default', async () => {
      db.profile.update.mockResolvedValue({ id: 'p1', isDefault: true })

      await invokeHandler(handlers, 'profile:select', 'p1')

      expect(db.profile.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false }
      })
      expect(db.profile.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isDefault: true }
      })
    })
  })
})
