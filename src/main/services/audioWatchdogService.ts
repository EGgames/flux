import log from 'electron-log'

export interface AudioWatchdogDeps {
  /** Devuelve la posicion actual en ms (o null si no hay track activo). */
  getPositionMs: () => number | null
  /** Estado actual del playout: solo se monitorea cuando 'playing'. */
  isPlaying: () => boolean
  /** Identificador del track actual; al cambiar se resetea el watcher. */
  getCurrentTrackId: () => string | null
  /** Accion a ejecutar cuando se detecta stall. */
  onStall: (info: { trackId: string; reason: 'no_progress' }) => void
  /** Umbral de stall en ms. Default 3000. */
  stallThresholdMs?: number
  /** Frecuencia de polling en ms. Default 1000. */
  pollMs?: number
}

/**
 * Monitorea el avance de la posicion del track activo. Si no hay progreso
 * durante stallThresholdMs estando en estado playing, dispara onStall.
 *
 * El watchdog es agnostico al backend de audio (Howler en renderer): main process
 * recibe la posicion via IPC peridico desde usePlayout.
 */
export class AudioWatchdog {
  private timer: NodeJS.Timeout | null = null
  private lastPosition: number | null = null
  private lastChangeAt: number = Date.now()
  private lastTrackId: string | null = null
  private readonly stallThresholdMs: number
  private readonly pollMs: number

  constructor(private readonly deps: AudioWatchdogDeps) {
    this.stallThresholdMs = deps.stallThresholdMs ?? 3000
    this.pollMs = deps.pollMs ?? 1000
  }

  start(): void {
    if (this.timer) return
    this.lastChangeAt = Date.now()
    this.timer = setInterval(() => this.tick(), this.pollMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.lastPosition = null
    this.lastTrackId = null
  }

  /** Expuesto para tests. */
  tick(): void {
    if (!this.deps.isPlaying()) {
      this.lastChangeAt = Date.now()
      this.lastPosition = null
      return
    }
    const trackId = this.deps.getCurrentTrackId()
    if (!trackId) return

    if (trackId !== this.lastTrackId) {
      this.lastTrackId = trackId
      this.lastPosition = this.deps.getPositionMs()
      this.lastChangeAt = Date.now()
      return
    }

    const pos = this.deps.getPositionMs()
    if (pos === null) return

    if (this.lastPosition === null || pos !== this.lastPosition) {
      this.lastPosition = pos
      this.lastChangeAt = Date.now()
      return
    }

    const stalledFor = Date.now() - this.lastChangeAt
    if (stalledFor >= this.stallThresholdMs) {
      log.warn(`[AudioWatchdog] stall detected for track ${trackId} (${stalledFor}ms)`)
      this.deps.onStall({ trackId, reason: 'no_progress' })
      // Reset para no spamear: el caller hace next() y al cambiar trackId vuelve a empezar.
      this.lastChangeAt = Date.now()
      this.lastPosition = null
    }
  }
}
