import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { registerOutputIpc } from '../../ipc/outputs.ipc'
import type { PrismaClient } from '@prisma/client'
import type { StreamingService } from '../../services/streamingService'
import { ipcMain } from 'electron'
import { getRegisteredHandlers, invokeHandler, createDbMock } from '../helpers/ipcHarness'

describe('outputs.ipc', () => {
  let db: ReturnType<typeof createDbMock>
  let streamingService: { disconnect: ReturnType<typeof vi.fn>; testConnection: ReturnType<typeof vi.fn> }
  let handlers: Map<string, (...args: unknown[]) => unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ipcMain.handle as ReturnType<typeof vi.fn>).mockClear()
    db = createDbMock()
    streamingService = { disconnect: vi.fn(), testConnection: vi.fn() }
    registerOutputIpc(db as unknown as PrismaClient, streamingService as unknown as StreamingService)
    handlers = getRegisteredHandlers()
  })

  it('registers all expected handlers', () => {
    for (const ch of ['output:list', 'output:save', 'output:delete', 'output:toggle', 'output:test']) {
      expect(handlers.has(ch)).toBe(true)
    }
  })

  describe('output:save', () => {
    it('updates existing output (upsert by profileId+outputType)', async () => {
      db.outputIntegration.findFirst.mockResolvedValue({ id: 'o1', enabled: true })
      db.outputIntegration.update.mockResolvedValue({ id: 'o1' })

      await invokeHandler(handlers, 'output:save', {
        profileId: 'p1', outputType: 'icecast', config: '{}'
      })

      expect(db.outputIntegration.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { config: '{}', enabled: true }
      })
      expect(db.outputIntegration.create).not.toHaveBeenCalled()
    })

    it('creates a new output when none exists', async () => {
      db.outputIntegration.findFirst.mockResolvedValue(null)
      db.outputIntegration.create.mockResolvedValue({ id: 'o1' })

      const data = { profileId: 'p1', outputType: 'shoutcast', config: '{}', enabled: false }
      await invokeHandler(handlers, 'output:save', data)

      expect(db.outputIntegration.create).toHaveBeenCalledWith({ data })
    })
  })

  describe('output:toggle', () => {
    it('disconnects streaming when disabling non-local output', async () => {
      db.outputIntegration.update.mockResolvedValue({ id: 'o1', outputType: 'icecast', enabled: false })

      await invokeHandler(handlers, 'output:toggle', 'o1', false)

      expect(streamingService.disconnect).toHaveBeenCalledWith('o1')
    })

    it('does NOT disconnect for local output', async () => {
      db.outputIntegration.update.mockResolvedValue({ id: 'o1', outputType: 'local', enabled: false })

      await invokeHandler(handlers, 'output:toggle', 'o1', false)

      expect(streamingService.disconnect).not.toHaveBeenCalled()
    })

    it('does NOT disconnect when enabling', async () => {
      db.outputIntegration.update.mockResolvedValue({ id: 'o1', outputType: 'icecast', enabled: true })

      await invokeHandler(handlers, 'output:toggle', 'o1', true)

      expect(streamingService.disconnect).not.toHaveBeenCalled()
    })
  })

  describe('output:test', () => {
    it('returns success directly for local outputs', async () => {
      db.outputIntegration.findUnique.mockResolvedValue({ id: 'o1', outputType: 'local', config: '{}' })

      const result = await invokeHandler(handlers, 'output:test', 'o1')

      expect(result).toEqual({ success: true, message: 'Tarjeta de sonido local configurada' })
      expect(streamingService.testConnection).not.toHaveBeenCalled()
    })

    it('delegates to streamingService for non-local outputs', async () => {
      db.outputIntegration.findUnique.mockResolvedValue({
        id: 'o1', outputType: 'icecast', config: '{"host":"h","port":8000}'
      })
      streamingService.testConnection.mockResolvedValue({ success: true, message: 'OK' })

      const result = await invokeHandler(handlers, 'output:test', 'o1')

      expect(streamingService.testConnection).toHaveBeenCalledWith('icecast', { host: 'h', port: 8000 })
      expect(result).toEqual({ success: true, message: 'OK' })
    })

    it('throws when output not found', async () => {
      db.outputIntegration.findUnique.mockResolvedValue(null)
      await expect(invokeHandler(handlers, 'output:test', 'o1')).rejects.toThrow('Integración no encontrada')
    })
  })
})
