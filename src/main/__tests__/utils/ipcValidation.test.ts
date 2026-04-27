import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

import { z } from 'zod'
import { validatedHandle } from '../../utils/ipcValidation'
import { ipcMain } from 'electron'

describe('validatedHandle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function lastHandler(): (event: unknown, raw: unknown) => Promise<unknown> {
    const calls = (ipcMain.handle as unknown as { mock: { calls: unknown[][] } }).mock.calls
    return calls[calls.length - 1][1] as (event: unknown, raw: unknown) => Promise<unknown>
  }

  it('registers a handler with given channel', () => {
    validatedHandle('test:foo', z.object({ a: z.string() }), () => 'ok')
    expect(ipcMain.handle).toHaveBeenCalledWith('test:foo', expect.any(Function))
  })

  it('throws with descriptive message when payload is invalid', async () => {
    const handler = vi.fn()
    validatedHandle('test:bar', z.object({ name: z.string().min(1) }), handler)
    const fn = lastHandler()
    await expect(fn({}, { name: '' })).rejects.toThrow(/IPC validation failed \[test:bar\].*name/)
    expect(handler).not.toHaveBeenCalled()
  })

  it('forwards parsed data to handler when payload is valid', async () => {
    const handler = vi.fn(async (_e: unknown, data: { name: string }) => `hi ${data.name}`)
    validatedHandle('test:baz', z.object({ name: z.string() }), handler)
    const fn = lastHandler()
    const result = await fn({ sender: {} }, { name: 'flux' })
    expect(result).toBe('hi flux')
    expect(handler).toHaveBeenCalledWith({ sender: {} }, { name: 'flux' })
  })

  it('reports root path issue', async () => {
    validatedHandle('test:qux', z.string(), () => 'ok')
    const fn = lastHandler()
    await expect(fn({}, 123)).rejects.toThrow(/\(root\)/)
  })
})
