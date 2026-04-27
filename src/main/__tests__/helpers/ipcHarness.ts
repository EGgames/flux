import { vi, type Mock } from 'vitest'
import { ipcMain } from 'electron'

/**
 * Extract handlers from a mocked ipcMain. Each test file must mock electron:
 *   vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))
 */
export function getRegisteredHandlers(): Map<string, (...args: unknown[]) => unknown> {
  const handle = ipcMain.handle as unknown as Mock
  const map = new Map<string, (...args: unknown[]) => unknown>()
  for (const call of handle.mock.calls) {
    const [channel, fn] = call as [string, (...args: unknown[]) => unknown]
    map.set(channel, fn)
  }
  return map
}

export async function invokeHandler<T = unknown>(
  handlers: Map<string, (...args: unknown[]) => unknown>,
  channel: string,
  ...args: unknown[]
): Promise<T> {
  const fn = handlers.get(channel)
  if (!fn) throw new Error(`No handler registered for channel: ${channel}`)
  return (await fn({ sender: {} } as unknown, ...args)) as T
}

/**
 * Build a Prisma-like mock with vi.fn() for every common delegate method.
 */
export function createDbMock() {
  const delegate = () => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn()
  })
  return {
    profile: delegate(),
    playlist: delegate(),
    playlistItem: delegate(),
    audioAsset: delegate(),
    adBlock: delegate(),
    adBlockItem: delegate(),
    adRule: delegate(),
    radioProgram: delegate(),
    soundboardButton: delegate(),
    outputIntegration: delegate(),
    playoutEvent: delegate(),
    audioEffectsConfig: delegate()
  }
}

export function createWindowMock() {
  const send = vi.fn()
  return {
    win: { webContents: { send } } as unknown as Electron.BrowserWindow,
    send
  }
}
