import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}))

const createConnectionMock = vi.fn()
vi.mock('net', () => ({
  default: { createConnection: (...args: unknown[]) => createConnectionMock(...args) }
}))

vi.mock('http', () => ({
  default: { request: vi.fn() }
}))

import { StreamingService } from '../../services/streamingService'
import { createWindowMock } from '../helpers/ipcHarness'
import http from 'http'

describe('StreamingService', () => {
  let win: ReturnType<typeof createWindowMock>
  let service: StreamingService

  beforeEach(() => {
    vi.clearAllMocks()
    win = createWindowMock()
    service = new StreamingService(win.win)
  })

  afterEach(() => {
    // Garantiza que un test que falla con fake timers no contagie a los siguientes.
    vi.useRealTimers()
  })

  describe('pushChunk', () => {
    it('does nothing when no connections exist', () => {
      expect(() => service.pushChunk(Buffer.from([1, 2, 3]))).not.toThrow()
    })

    it('writes only to active connections with writable sockets', () => {
      const writeActive = vi.fn()
      const writeInactive = vi.fn()
      const writeNotWritable = vi.fn()

      const connections = (service as unknown as {
        connections: Map<string, { active: boolean; socket: { writable: boolean; write: (b: Buffer) => void } }>
      }).connections

      connections.set('a', { active: true, socket: { writable: true, write: writeActive } })
      connections.set('b', { active: false, socket: { writable: true, write: writeInactive } })
      connections.set('c', { active: true, socket: { writable: false, write: writeNotWritable } })

      const chunk = Buffer.from([0xFF])
      service.pushChunk(chunk)

      expect(writeActive).toHaveBeenCalledWith(chunk)
      expect(writeInactive).not.toHaveBeenCalled()
      expect(writeNotWritable).not.toHaveBeenCalled()
    })

    it('ignores active connections without socket', () => {
      const connections = (service as unknown as {
        connections: Map<string, { active: boolean; socket?: { writable: boolean; write: (b: Buffer) => void } }>
      }).connections

      connections.set('a', { active: true })

      expect(() => service.pushChunk(Buffer.from([0x01]))).not.toThrow()
    })
  })

  describe('connectIcecast', () => {
    it('is a no-op when connection is already active', async () => {
      const connections = (service as unknown as {
        connections: Map<string, { active: boolean }>
      }).connections
      connections.set('ice-1', { active: true })

      await service.connectIcecast('ice-1', {
        host: 'localhost',
        port: 8000,
        mount: '/live',
        username: 'source',
        password: 'pass'
      })

      expect(createConnectionMock).not.toHaveBeenCalled()
    })

    it('connects and writes SOURCE headers with default bitrate', async () => {
      const handlers: Record<string, (arg?: unknown) => void> = {}
      const socket = {
        writable: true,
        write: vi.fn(),
        destroy: vi.fn(),
        on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
          handlers[event] = cb
        })
      }
      createConnectionMock.mockImplementation((_opts: unknown, cb: () => void) => {
        queueMicrotask(cb)
        return socket
      })

      await service.connectIcecast('ice-1', {
        host: 'localhost',
        port: 8000,
        mount: '/radio',
        username: 'source',
        password: 'secret'
      })
      await Promise.resolve()

      expect(socket.write).toHaveBeenCalledTimes(1)
      const headers = socket.write.mock.calls[0][0] as string
      expect(headers).toContain('SOURCE /radio HTTP/1.0')
      expect(headers).toContain('ice-bitrate: 128')
      expect(win.send).toHaveBeenCalledWith('streaming:status-changed', {
        id: 'ice-1',
        status: 'connected',
        message: undefined
      })
      expect(handlers.error).toBeTypeOf('function')
      expect(handlers.close).toBeTypeOf('function')
    })

    it('emits error and reconnecting when socket errors', async () => {
      vi.useFakeTimers()
      const handlers: Record<string, (arg?: unknown) => void> = {}
      const socket = {
        writable: true,
        write: vi.fn(),
        destroy: vi.fn(),
        on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
          handlers[event] = cb
        })
      }
      createConnectionMock.mockImplementation((_opts: unknown, cb: () => void) => {
        queueMicrotask(cb)
        return socket
      })

      await service.connectIcecast('ice-err', {
        host: 'localhost',
        port: 8000,
        mount: '/radio',
        username: 'source',
        password: 'secret',
        bitrate: 192
      })
      await Promise.resolve()

      handlers.error?.(new Error('ECONNRESET'))
      vi.advanceTimersByTime(5000)

      expect(win.send).toHaveBeenCalledWith('streaming:status-changed', {
        id: 'ice-err',
        status: 'error',
        message: 'ECONNRESET'
      })
      expect(win.send).toHaveBeenCalledWith('streaming:status-changed', {
        id: 'ice-err',
        status: 'reconnecting',
        message: 'attempt #1'
      })
      vi.useRealTimers()
    })

    it('marks disconnected and schedules reconnect on close', async () => {
      vi.useFakeTimers()
      const handlers: Record<string, () => void> = {}
      const socket = {
        writable: true,
        write: vi.fn(),
        destroy: vi.fn(),
        on: vi.fn((event: string, cb: () => void) => {
          handlers[event] = cb
        })
      }
      createConnectionMock.mockImplementation((_opts: unknown, cb: () => void) => {
        queueMicrotask(cb)
        return socket
      })

      await service.connectIcecast('ice-close', {
        host: 'localhost',
        port: 8000,
        mount: '/radio',
        username: 'source',
        password: 'secret'
      })
      await Promise.resolve()

      handlers.close?.()
      vi.advanceTimersByTime(5000)

      expect(win.send).toHaveBeenCalledWith('streaming:status-changed', {
        id: 'ice-close',
        status: 'disconnected',
        message: undefined
      })
      expect(win.send).toHaveBeenCalledWith('streaming:status-changed', {
        id: 'ice-close',
        status: 'reconnecting',
        message: 'attempt #1'
      })
      vi.useRealTimers()
    })
  })

  describe('connectShoutcast', () => {
    it('connects using default mount and emits error for non-200 response', async () => {
      vi.useFakeTimers()
      const requestMock = vi.mocked(http.request)
      const reqHandlers: Record<string, (arg?: unknown) => void> = {}
      const req = {
        socket: { writable: true, write: vi.fn(), destroy: vi.fn() },
        on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
          reqHandlers[event] = cb
        })
      }

      requestMock.mockImplementation((options: unknown, cb: (res: { statusCode?: number }) => void) => {
        const typed = options as { path: string }
        expect(typed.path).toBe('/stream')
        queueMicrotask(() => cb({ statusCode: 500 }))
        return req as unknown as http.ClientRequest
      })

      await service.connectShoutcast('shout-1', {
        host: 'localhost',
        port: 8001,
        password: 'pwd'
      })
      await Promise.resolve()

      vi.advanceTimersByTime(5000)

      expect(win.send).toHaveBeenCalledWith('streaming:status-changed', {
        id: 'shout-1',
        status: 'connected',
        message: undefined
      })
      expect(win.send).toHaveBeenCalledWith('streaming:status-changed', {
        id: 'shout-1',
        status: 'error',
        message: 'HTTP 500'
      })
      expect(win.send).toHaveBeenCalledWith('streaming:status-changed', {
        id: 'shout-1',
        status: 'reconnecting',
        message: 'attempt #1'
      })
      expect(reqHandlers.error).toBeTypeOf('function')
      vi.useRealTimers()
    })

    it('emits error and schedules reconnect on request error', async () => {
      vi.useFakeTimers()
      const requestMock = vi.mocked(http.request)
      const reqHandlers: Record<string, (arg?: unknown) => void> = {}
      const req = {
        socket: { writable: true, write: vi.fn(), destroy: vi.fn() },
        on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
          reqHandlers[event] = cb
        })
      }

      requestMock.mockImplementation((_options: unknown, cb: (res: { statusCode?: number }) => void) => {
        cb({ statusCode: 200 })
        return req as unknown as http.ClientRequest
      })

      await service.connectShoutcast('shout-err', {
        host: 'localhost',
        port: 8001,
        password: 'pwd',
        mount: '/live'
      })

      reqHandlers.error?.(new Error('socket-write-failed'))
      vi.advanceTimersByTime(5000)

      expect(win.send).toHaveBeenCalledWith('streaming:status-changed', {
        id: 'shout-err',
        status: 'error',
        message: 'socket-write-failed'
      })
      expect(win.send).toHaveBeenCalledWith('streaming:status-changed', {
        id: 'shout-err',
        status: 'reconnecting',
        message: 'attempt #1'
      })
      vi.useRealTimers()
    })
  })

  describe('testConnection', () => {
    it('resolves success when socket connects', async () => {
      const socket = {
        destroy: vi.fn(),
        setTimeout: vi.fn(),
        on: vi.fn()
      }
      createConnectionMock.mockImplementation((_opts: unknown, cb: () => void) => {
        setImmediate(cb)
        return socket
      })

      const result = await service.testConnection('icecast', {
        host: 'localhost', port: 8000, mount: '/s', username: 's', password: 'p'
      })

      expect(result).toEqual({ success: true, message: 'Conexión exitosa' })
      expect(socket.destroy).toHaveBeenCalled()
    })

    it('resolves with error message on socket error', async () => {
      const handlers: Record<string, (arg?: unknown) => void> = {}
      const socket = {
        destroy: vi.fn(),
        setTimeout: vi.fn(),
        on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
          handlers[event] = cb
        })
      }
      createConnectionMock.mockImplementation(() => socket)

      const promise = service.testConnection('icecast', {
        host: 'bad', port: 1, mount: '/s', username: 's', password: 'p'
      })
      // Trigger error
      handlers.error?.(new Error('ECONNREFUSED'))

      const result = await promise
      expect(result).toEqual({ success: false, message: 'ECONNREFUSED' })
    })

    it('resolves with timeout message on timeout', async () => {
      const handlers: Record<string, () => void> = {}
      const socket = {
        destroy: vi.fn(),
        setTimeout: vi.fn(),
        on: vi.fn((event: string, cb: () => void) => {
          handlers[event] = cb
        })
      }
      createConnectionMock.mockImplementation(() => socket)

      const promise = service.testConnection('icecast', {
        host: 'h', port: 1, mount: '/s', username: 's', password: 'p'
      })
      handlers.timeout?.()

      const result = await promise
      expect(result).toEqual({ success: false, message: 'Tiempo de espera agotado' })
      expect(socket.destroy).toHaveBeenCalled()
    })
  })

  describe('disconnect', () => {
    it('clears the connection from the map', () => {
      const socket = { destroy: vi.fn(), writable: true }
      const connections = (service as unknown as {
        connections: Map<string, unknown>
      }).connections
      connections.set('id1', { id: 'id1', type: 'icecast', socket, active: true })

      service.disconnect('id1')

      expect(socket.destroy).toHaveBeenCalled()
      expect(connections.has('id1')).toBe(false)
      expect(win.send).toHaveBeenCalledWith('streaming:status-changed', expect.objectContaining({
        id: 'id1', status: 'disconnected'
      }))
    })

    it('clears reconnect timer if present', () => {
      const timer = setTimeout(() => {}, 1000)
      const clearSpy = vi.spyOn(global, 'clearTimeout')
      const socket = { destroy: vi.fn() }
      const connections = (service as unknown as {
        connections: Map<string, unknown>
      }).connections
      connections.set('id1', { id: 'id1', type: 'icecast', socket, active: true, reconnectTimer: timer })

      service.disconnect('id1')

      expect(clearSpy).toHaveBeenCalledWith(timer)
      clearSpy.mockRestore()
    })

    it('is a no-op when id does not exist', () => {
      expect(() => service.disconnect('missing')).not.toThrow()
      expect(win.send).not.toHaveBeenCalled()
    })
  })

  describe('disconnectAll', () => {
    it('disconnects every registered connection', () => {
      const connections = (service as unknown as {
        connections: Map<string, unknown>
      }).connections
      connections.set('a', { id: 'a', type: 'icecast', socket: { destroy: vi.fn() }, active: true })
      connections.set('b', { id: 'b', type: 'shoutcast', socket: { destroy: vi.fn() }, active: true })

      service.disconnectAll()

      expect(connections.size).toBe(0)
    })
  })
})
