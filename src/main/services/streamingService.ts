import net from 'net'
import http from 'http'
import type { BrowserWindow } from 'electron'
import log from 'electron-log'

interface IcecastConfig {
  host: string
  port: number
  mount: string
  username: string
  password: string
  bitrate?: number
}

interface ShoutcastConfig {
  host: string
  port: number
  password: string
  mount?: string
}

interface Connection {
  id: string
  type: 'icecast' | 'shoutcast'
  socket?: net.Socket
  active: boolean
  reconnectTimer?: NodeJS.Timeout
  /** Numero de intentos de reconexion consecutivos. Resetea a 0 al conectar OK. */
  reconnectAttempts: number
  /** Config original para poder re-conectar. */
  config: IcecastConfig | ShoutcastConfig
  /** True si el usuario llamo disconnect() explicito. Bloquea la reconexion. */
  manualDisconnect: boolean
}

const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 60000

export class StreamingService {
  private connections = new Map<string, Connection>()

  constructor(private win: BrowserWindow) {}

  /**
   * Push an audio chunk to all active streaming connections.
   */
  pushChunk(chunk: Buffer): void {
    for (const [, conn] of this.connections) {
      if (conn.active && conn.socket?.writable) {
        conn.socket.write(chunk)
      }
    }
  }

  /**
   * Connect to Icecast server using the SOURCE HTTP method.
   */
  async connectIcecast(id: string, config: IcecastConfig): Promise<void> {
    const existing = this.connections.get(id)
    if (existing?.active) return

    const auth = Buffer.from(`source:${config.password}`).toString('base64')
    const socket = net.createConnection({ host: config.host, port: config.port }, () => {
      const headers = [
        `SOURCE ${config.mount} HTTP/1.0`,
        `Authorization: Basic ${auth}`,
        `Host: ${config.host}`,
        `Content-Type: audio/mpeg`,
        `ice-name: FLUX`,
        `ice-bitrate: ${config.bitrate ?? 128}`,
        '',
        ''
      ].join('\r\n')
      socket.write(headers)
    })

    socket.on('error', (err) => {
      log.error(`Icecast [${id}] error:`, err.message)
      this.emitStatus(id, 'error', err.message)
      this.scheduleReconnect(id)
    })

    socket.on('close', () => {
      const conn = this.connections.get(id)
      if (conn) conn.active = false
      this.emitStatus(id, 'disconnected')
      this.scheduleReconnect(id)
    })

    const existingState = this.connections.get(id)
    this.connections.set(id, {
      id,
      type: 'icecast',
      socket,
      active: true,
      reconnectAttempts: 0,
      config,
      manualDisconnect: false,
      reconnectTimer: existingState?.reconnectTimer
    })
    this.emitStatus(id, 'connected')
    log.info(`Icecast [${id}] connected to ${config.host}:${config.port}${config.mount}`)
  }

  /**
   * Connect to Shoutcast v2 using HTTP PUT.
   */
  async connectShoutcast(id: string, config: ShoutcastConfig): Promise<void> {
    const mount = config.mount ?? '/stream'
    const req = http.request(
      {
        hostname: config.host,
        port: config.port,
        path: mount,
        method: 'PUT',
        headers: {
          Authorization: `Basic ${Buffer.from(`:${config.password}`).toString('base64')}`,
          'Content-Type': 'audio/mpeg',
          'Transfer-Encoding': 'chunked'
        }
      },
      (res) => {
        log.info(`Shoutcast [${id}] response: ${res.statusCode}`)
        if (res.statusCode !== 200) {
          this.emitStatus(id, 'error', `HTTP ${res.statusCode}`)
          this.scheduleReconnect(id)
        }
      }
    )

    req.on('error', (err) => {
      log.error(`Shoutcast [${id}] error:`, err.message)
      this.emitStatus(id, 'error', err.message)
      this.scheduleReconnect(id)
    })

    // Expose socket via req.socket for writing
    const socket = req.socket as net.Socket
    const existingState = this.connections.get(id)
    this.connections.set(id, {
      id,
      type: 'shoutcast',
      socket,
      active: true,
      reconnectAttempts: 0,
      config,
      manualDisconnect: false,
      reconnectTimer: existingState?.reconnectTimer
    })
    this.emitStatus(id, 'connected')
    log.info(`Shoutcast [${id}] connected to ${config.host}:${config.port}`)
  }

  async testConnection(
    _outputType: string,
    config: IcecastConfig | ShoutcastConfig
  ): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const cfg = config as IcecastConfig
      const socket = net.createConnection({ host: cfg.host, port: cfg.port }, () => {
        socket.destroy()
        resolve({ success: true, message: 'Conexión exitosa' })
      })
      socket.setTimeout(5000)
      socket.on('error', (err) => resolve({ success: false, message: err.message }))
      socket.on('timeout', () => {
        socket.destroy()
        resolve({ success: false, message: 'Tiempo de espera agotado' })
      })
    })
  }

  disconnect(id: string): void {
    const conn = this.connections.get(id)
    if (conn) {
      conn.active = false
      conn.manualDisconnect = true
      if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer)
      conn.socket?.destroy()
      this.connections.delete(id)
      this.emitStatus(id, 'disconnected')
    }
  }

  disconnectAll(): void {
    for (const id of this.connections.keys()) {
      this.disconnect(id)
    }
  }

  /**
   * Calcula el delay del proximo intento siguiendo backoff exponencial:
   * 1s, 2s, 4s, 8s, 16s, 32s, 60s (cap). Util para tests.
   */
  static computeBackoff(attempt: number, baseMs = BASE_BACKOFF_MS, capMs = MAX_BACKOFF_MS): number {
    const exp = baseMs * 2 ** Math.max(0, attempt)
    return Math.min(capMs, exp)
  }

  private scheduleReconnect(id: string): void {
    const conn = this.connections.get(id)
    if (!conn) return
    if (conn.manualDisconnect) return
    if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer)

    const attempts = typeof conn.reconnectAttempts === 'number' ? conn.reconnectAttempts : 0
    const delayMs = StreamingService.computeBackoff(attempts)
    conn.reconnectAttempts = attempts + 1
    log.info(`[stream:${id}] reconnect attempt #${conn.reconnectAttempts} in ${delayMs}ms`)
    this.emitStatus(id, 'reconnecting', `attempt #${conn.reconnectAttempts}`)

    conn.reconnectTimer = setTimeout(() => {
      const current = this.connections.get(id)
      if (!current || current.manualDisconnect) return
      const cfg = current.config
      // Re-conectar segun tipo. Si exitoso, los handlers internos resetean reconnectAttempts.
      if (current.type === 'icecast') {
        void this.connectIcecast(id, cfg as IcecastConfig).catch((err) =>
          log.error(`[stream:${id}] icecast reconnect failed`, err)
        )
      } else {
        void this.connectShoutcast(id, cfg as ShoutcastConfig).catch((err) =>
          log.error(`[stream:${id}] shoutcast reconnect failed`, err)
        )
      }
    }, delayMs)
  }

  private emitStatus(id: string, status: string, message?: string): void {
    this.win.webContents.send('streaming:status-changed', { id, status, message })
  }
}
