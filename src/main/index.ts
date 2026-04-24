import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import http from 'http'

// Must be called before app.ready — keep scheme registered even though we use HTTP server
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-audio',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])
import { closeDb, getDb } from './db'
import { registerProfileIpc } from './ipc/profiles.ipc'
import { registerAudioAssetIpc } from './ipc/audioAssets.ipc'
import { registerPlaylistIpc } from './ipc/playlists.ipc'
import { registerAdBlockIpc } from './ipc/adBlocks.ipc'
import { registerSoundboardIpc } from './ipc/soundboard.ipc'
import { registerProgramIpc } from './ipc/programs.ipc'
import { registerOutputIpc } from './ipc/outputs.ipc'
import { registerPlayoutIpc } from './ipc/playout.ipc'
import { SchedulerService } from './services/schedulerService'
import { StreamingService } from './services/streamingService'
import log from 'electron-log'

let mainWindow: BrowserWindow | null = null
let schedulerService: SchedulerService | null = null
export let streamingService: StreamingService | null = null
let audioServerPort: number | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // Permitir media (microfono) y speaker-selection (setSinkId) sin prompt.
  // Sin esto Chromium devuelve deviceIds anonimizados desde enumerateDevices y
  // HTMLMediaElement.setSinkId rechaza con NotFoundError. Es una app de escritorio
  // de un solo usuario, no hay riesgo en otorgar permisos a nuestro propio renderer.
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media') return callback(true)
    callback(false)
  })
  mainWindow.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'media'
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const AUDIO_CONTENT_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  opus: 'audio/ogg; codecs=opus'
}

// Custom protocol to serve local audio files securely
// URL format: local-audio://?p=C%3A%2FUsers%2F... (path as query param)
function registerLocalAudioProtocol(): void {
  protocol.handle('local-audio', async (request) => {
    try {
      const url = new URL(request.url)
      const filePath = url.searchParams.get('p')
      if (!filePath) return new Response('Missing path', { status: 400 })

      const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
      const contentType = AUDIO_CONTENT_TYPES[ext] ?? 'audio/mpeg'

      const buffer = await fs.readFile(filePath)
      const total = buffer.length
      const rangeHeader = request.headers.get('range')

      if (rangeHeader) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
        const start = match?.[1] ? parseInt(match[1]) : 0
        const end = match?.[2] ? parseInt(match[2]) : total - 1
        const chunk = buffer.slice(start, end + 1)
        return new Response(chunk, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunk.length),
            'Access-Control-Allow-Origin': '*'
          }
        })
      }

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(total),
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (err) {
      log.error('local-audio protocol error:', err)
      return new Response('File not found', { status: 404 })
    }
  })
}

const ALLOWED_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'])

function startAudioHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlObj = new URL(req.url ?? '/', 'http://localhost')
        const filePath = urlObj.searchParams.get('p')
        if (!filePath) {
          res.writeHead(400)
          res.end('Bad Request')
          return
        }

        const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
        if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }

        const contentType = AUDIO_CONTENT_TYPES[ext] ?? 'audio/mpeg'
        const buffer = await fs.readFile(filePath)
        const total = buffer.length
        const rangeHeader = req.headers.range

        if (rangeHeader) {
          const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
          const start = match?.[1] ? parseInt(match[1]) : 0
          const end = match?.[2] ? parseInt(match[2]) : total - 1
          const chunk = buffer.slice(start, end + 1)
          res.writeHead(206, {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunk.length,
            'Access-Control-Allow-Origin': '*'
          })
          res.end(chunk)
        } else {
          res.writeHead(200, {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Content-Length': total,
            'Access-Control-Allow-Origin': '*'
          })
          res.end(buffer)
        }
      } catch (err) {
        log.error('Audio HTTP server error:', err)
        res.writeHead(404)
        res.end('Not Found')
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      audioServerPort = addr.port
      log.info(`Audio HTTP server started on port ${audioServerPort}`)
      resolve()
    })
    server.on('error', reject)
  })
}

async function initializeApp(): Promise<void> {
  const db = getDb()

  // Ensure default profile exists
  const profileCount = await db.profile.count()
  if (profileCount === 0) {
    await db.profile.create({
      data: { name: 'Default', isDefault: true }
    })
    log.info('Created default profile')
  }

  schedulerService = new SchedulerService(db, mainWindow!)
  streamingService = new StreamingService(mainWindow!)

  // Register all IPC handlers
  registerProfileIpc(db)
  registerAudioAssetIpc(db)
  registerPlaylistIpc(db)
  registerAdBlockIpc(db)
  registerSoundboardIpc(db)
  registerProgramIpc(db)
  registerOutputIpc(db, streamingService)
  registerPlayoutIpc(db, schedulerService, streamingService, mainWindow!)

  ipcMain.handle('audio:server-port', () => audioServerPort)

  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.restore()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)

  await schedulerService.start()
  log.info('FLUX started')
}

app.whenReady().then(async () => {
  await startAudioHttpServer()
  registerLocalAudioProtocol()
  createWindow()
  await initializeApp()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  schedulerService?.stop()
  streamingService?.disconnectAll()
  await closeDb()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  schedulerService?.stop()
  streamingService?.disconnectAll()
  await closeDb()
})
