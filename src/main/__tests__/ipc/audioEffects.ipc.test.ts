import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => {
  const ipcMain = { handle: vi.fn() }
  return { ipcMain, default: { ipcMain } }
})

import { registerAudioEffectsIpc } from '../../ipc/audioEffects.ipc'
import type { PrismaClient } from '@prisma/client'
import { ipcMain } from 'electron'
import { getRegisteredHandlers, invokeHandler } from '../helpers/ipcHarness'

function makeDb() {
  return {
    audioEffectsConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn()
    }
  }
}

describe('audioEffects.ipc', () => {
  let db: ReturnType<typeof makeDb>
  let handlers: Map<string, (...args: unknown[]) => unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ipcMain.handle as ReturnType<typeof vi.fn>).mockClear()
    db = makeDb()
    registerAudioEffectsIpc(db as unknown as PrismaClient)
    handlers = getRegisteredHandlers()
  })

  it('registra los dos handlers', () => {
    expect(handlers.has('audio-effects:get')).toBe(true)
    expect(handlers.has('audio-effects:update')).toBe(true)
  })

  describe('audio-effects:get', () => {
    it('retorna null si no hay profileId', async () => {
      const r = await invokeHandler(handlers, 'audio-effects:get', '')
      expect(r).toBeNull()
    })

    it('retorna config existente', async () => {
      db.audioEffectsConfig.findUnique.mockResolvedValue({ id: 'c1', profileId: 'p1' })
      const r = await invokeHandler(handlers, 'audio-effects:get', 'p1')
      expect(r).toEqual({ id: 'c1', profileId: 'p1' })
      expect(db.audioEffectsConfig.create).not.toHaveBeenCalled()
    })

    it('crea config por defecto si no existe', async () => {
      db.audioEffectsConfig.findUnique.mockResolvedValue(null)
      db.audioEffectsConfig.create.mockResolvedValue({ id: 'c1', profileId: 'p1' })
      const r = await invokeHandler(handlers, 'audio-effects:get', 'p1')
      expect(db.audioEffectsConfig.create).toHaveBeenCalledWith({ data: { profileId: 'p1' } })
      expect(r).toEqual({ id: 'c1', profileId: 'p1' })
    })
  })

  describe('audio-effects:update', () => {
    it('clamp crossfadeMs a 500..15000 y redondea', async () => {
      db.audioEffectsConfig.upsert.mockResolvedValue({ id: 'c1' })
      await invokeHandler(handlers, 'audio-effects:update', { profileId: 'p1', crossfadeMs: 99999.7 })
      const arg = db.audioEffectsConfig.upsert.mock.calls[0][0]
      expect(arg.update.crossfadeMs).toBe(15000)
    })

    it('clamp inferior 100→500', async () => {
      db.audioEffectsConfig.upsert.mockResolvedValue({ id: 'c1' })
      await invokeHandler(handlers, 'audio-effects:update', { profileId: 'p1', crossfadeMs: 100 })
      const arg = db.audioEffectsConfig.upsert.mock.calls[0][0]
      expect(arg.update.crossfadeMs).toBe(500)
    })

    it('rechaza curve inválida', async () => {
      db.audioEffectsConfig.upsert.mockResolvedValue({ id: 'c1' })
      await invokeHandler(handlers, 'audio-effects:update', { profileId: 'p1', crossfadeCurve: 'sawtooth' })
      const arg = db.audioEffectsConfig.upsert.mock.calls[0][0]
      expect(arg.update.crossfadeCurve).toBeUndefined()
    })

    it('acepta curve linear', async () => {
      db.audioEffectsConfig.upsert.mockResolvedValue({ id: 'c1' })
      await invokeHandler(handlers, 'audio-effects:update', { profileId: 'p1', crossfadeCurve: 'linear' })
      const arg = db.audioEffectsConfig.upsert.mock.calls[0][0]
      expect(arg.update.crossfadeCurve).toBe('linear')
    })

    it('rechaza enabled no booleano', async () => {
      db.audioEffectsConfig.upsert.mockResolvedValue({ id: 'c1' })
      await invokeHandler(handlers, 'audio-effects:update', { profileId: 'p1', crossfadeEnabled: 'yes' })
      const arg = db.audioEffectsConfig.upsert.mock.calls[0][0]
      expect(arg.update.crossfadeEnabled).toBeUndefined()
    })

    it('upsert usa profileId como where y aplica todos los campos válidos', async () => {
      db.audioEffectsConfig.upsert.mockResolvedValue({ id: 'c1' })
      await invokeHandler(handlers, 'audio-effects:update', {
        profileId: 'p1',
        crossfadeEnabled: true,
        crossfadeMs: 4000,
        crossfadeCurve: 'equal-power'
      })
      const arg = db.audioEffectsConfig.upsert.mock.calls[0][0]
      expect(arg.where).toEqual({ profileId: 'p1' })
      expect(arg.update).toEqual({
        crossfadeEnabled: true,
        crossfadeMs: 4000,
        crossfadeCurve: 'equal-power'
      })
      expect(arg.create).toEqual({
        profileId: 'p1',
        crossfadeEnabled: true,
        crossfadeMs: 4000,
        crossfadeCurve: 'equal-power'
      })
    })
  })
})
