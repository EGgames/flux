import { app, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
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

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Custom protocol to serve local audio files securely
function registerLocalAudioProtocol(): void {
  protocol.handle('local-audio', (request) => {
    const filePath = request.url.replace('local-audio://', '')
    const decodedPath = decodeURIComponent(filePath)
    return net.fetch(pathToFileURL(decodedPath).toString())
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

  await schedulerService.start()
  log.info('FLUX started')
}

app.whenReady().then(async () => {
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
