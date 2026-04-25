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
}

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
      this.scheduleReconnect(id)
      this.emitStatus(id, 'error', err.message)
    })

    socket.on('close', () => {
      const conn = this.connections.get(id)
      if (conn) conn.active = false
      this.emitStatus(id, 'disconnected')
      this.scheduleReconnect(id)
    })

    this.connections.set(id, { id, type: 'icecast', socket, active: true })
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
    this.connections.set(id, { id, type: 'shoutcast', socket, active: true })
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

  private scheduleReconnect(id: string, delayMs = 5000): void {
    const conn = this.connections.get(id)
    if (!conn) return
    if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer)
    conn.reconnectTimer = setTimeout(() => {
      log.info(`Attempting reconnect for [${id}]`)
      this.emitStatus(id, 'reconnecting')
    }, delayMs)
  }

  private emitStatus(id: string, status: string, message?: string): void {
    this.win.webContents.send('streaming:status-changed', { id, status, message })
  }
}
