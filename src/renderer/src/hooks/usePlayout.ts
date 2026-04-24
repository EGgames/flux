import { useState, useEffect, useCallback, useRef } from 'react'
import { Howl, Howler } from 'howler'
import type { PlayoutStatus, AudioAsset, AdRule } from '../types/ipc.types'
import { playoutService } from '../services/playoutService'
import { outputService } from '../services/outputService'

interface LocalOutputConfig {
  deviceId?: string
  deviceName?: string
}

// ===== Equalizer (10 bandas ISO estilo Winamp) =====
// Frecuencias ISO con espaciado de 1 octava: 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz.
// Q = sqrt(2) ~ 1.4142 es el valor canonico para bandas de octava (-3 dB en los bordes vecinos),
// asi que cuando todas las gananacias estan en 0 la respuesta es plana sin coloracion.
export const EQ_BAND_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
export const EQ_BANDS_COUNT = EQ_BAND_FREQS.length
export const EQ_GAIN_MIN = -12
export const EQ_GAIN_MAX = 12
export const EQ_PEAKING_Q = Math.SQRT2

export interface EqualizerPreset {
  id: string
  name: string
  gains: number[]
  builtIn: boolean
}

export const BUILT_IN_EQ_PRESETS: EqualizerPreset[] = [
  // 10 bandas: 31  62  125 250 500 1k  2k  4k  8k  16k
  { id: 'flat',       name: 'Flat',       gains: [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0], builtIn: true },
  { id: 'rock',       name: 'Rock',       gains: [ 5,  4,  3, -1, -2, -1,  1,  3,  4,  5], builtIn: true },
  { id: 'jazz',       name: 'Jazz',       gains: [ 3,  2,  1,  2,  1, -1, -1,  0,  1,  2], builtIn: true },
  { id: 'pop',        name: 'Pop',        gains: [-1, -1,  0,  2,  3,  4,  3,  1, -1, -2], builtIn: true },
  { id: 'classical',  name: 'Clásico',    gains: [ 4,  4,  3,  2,  0,  0,  0,  1,  2,  3], builtIn: true },
  { id: 'bass-boost', name: 'Bass Boost', gains: [ 6,  6,  5,  3,  1,  0,  0,  0,  0,  0], builtIn: true },
  { id: 'treble-boost', name: 'Treble Boost', gains: [ 0,  0,  0,  0,  0,  0,  2,  4,  5,  6], builtIn: true },
  { id: 'vocal',      name: 'Vocal',      gains: [-2, -2, -1,  1,  3,  3,  2,  1,  0, -1], builtIn: true },
  { id: 'dance',      name: 'Dance',      gains: [ 5,  4,  3,  1,  0, -1, -1,  1,  3,  4], builtIn: true },
  { id: 'loudness',   name: 'Loudness',   gains: [ 5,  4,  2,  0, -1, -1,  0,  2,  4,  5], builtIn: true }
]

export interface EqualizerState {
  enabled: boolean
  gains: number[]   // length === EQ_BANDS_COUNT
  presetId: string  // 'flat' | ... | 'custom' | id de preset guardado
}

function defaultEqState(): EqualizerState {
  return { enabled: true, gains: new Array(EQ_BANDS_COUNT).fill(0), presetId: 'flat' }
}

function clampGain(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(EQ_GAIN_MIN, Math.min(EQ_GAIN_MAX, Math.round(v)))
}

function normalizeGains(gains: unknown): number[] {
  const arr = Array.isArray(gains) ? gains : []
  const out = new Array<number>(EQ_BANDS_COUNT).fill(0)
  for (let i = 0; i < EQ_BANDS_COUNT; i++) out[i] = clampGain(Number(arr[i] ?? 0))
  return out
}

function eqStorageKey(profileId: string | null): string | null {
  return profileId ? `eq:v2:${profileId}` : null
}

interface PersistedEqPayload {
  enabled: boolean
  presetId: string
  gains: number[]
  customPresets: EqualizerPreset[]
}

function loadPersistedEq(profileId: string | null): PersistedEqPayload | null {
  const key = eqStorageKey(profileId)
  if (!key || typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedEqPayload>
    return {
      enabled: parsed.enabled !== false,
      presetId: typeof parsed.presetId === 'string' ? parsed.presetId : 'flat',
      gains: normalizeGains(parsed.gains),
      customPresets: Array.isArray(parsed.customPresets)
        ? parsed.customPresets
            .filter((p): p is EqualizerPreset => !!p && typeof p.id === 'string' && typeof p.name === 'string')
            .map((p) => ({ id: p.id, name: p.name, gains: normalizeGains(p.gains), builtIn: false }))
        : []
    }
  } catch {
    return null
  }
}

function savePersistedEq(profileId: string | null, payload: PersistedEqPayload): void {
  const key = eqStorageKey(profileId)
  if (!key || typeof window === 'undefined' || !window.localStorage) return
  try { window.localStorage.setItem(key, JSON.stringify(payload)) } catch { /* quota */ }
}

export interface PlayoutLogEntry {
  id: string
  timestamp: number  // ms epoch — la hora se formatea en la UI con toLocaleTimeString()
  level: 'info' | 'warn' | 'error'
  message: string
}

const MAX_LOG_ENTRIES = 500

interface TimeRule {
  dayOfWeek: number
  time: string
}

function parseTimeRule(rule: AdRule): TimeRule | null {
  if (rule.triggerType !== 'time') return null

  try {
    const parsed = JSON.parse(rule.triggerConfig) as { dayOfWeek?: number; time?: string }
    if (typeof parsed.dayOfWeek === 'number' && typeof parsed.time === 'string') {
      return { dayOfWeek: parsed.dayOfWeek, time: parsed.time }
    }
    if (typeof parsed.time === 'string') {
      return { dayOfWeek: -1, time: parsed.time }
    }
  } catch {
    if (/^\d{2}:\d{2}$/.test(rule.triggerConfig)) {
      return { dayOfWeek: -1, time: rule.triggerConfig }
    }
  }

  return null
}

function getNextOccurrenceMs(now: Date, rule: TimeRule): number | null {
  const [hh, mm] = rule.time.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null

  let candidate: Date | null = null
  for (let offset = 0; offset <= 7; offset++) {
    const test = new Date(now)
    test.setDate(now.getDate() + offset)
    test.setHours(hh, mm, 0, 0)

    const matchesDay = rule.dayOfWeek === -1 || test.getDay() === rule.dayOfWeek
    if (!matchesDay) continue
    if (test.getTime() <= now.getTime()) continue

    candidate = test
    break
  }

  return candidate?.getTime() ?? null
}

function formatHms(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds))
  const hh = Math.floor(clamped / 3600)
  const mm = Math.floor((clamped % 3600) / 60)
  const ss = clamped % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

// Patch global del constructor Audio para que TODO <audio> nazca con crossOrigin='anonymous'.
// Necesario para que createMediaElementSource() reciba samples reales y no silencio:
// - El audio se sirve desde http://127.0.0.1:<port> (distinto origin del renderer).
// - El server emite Access-Control-Allow-Origin: *.
// - Pero <audio> SOLO realiza el fetch en modo CORS si crossOrigin esta seteado ANTES de la carga.
// - Howler html5 crea sus elementos con `new Audio()`, asi que parchamos el constructor global.
if (typeof window !== 'undefined' && !(window as unknown as { __audioCrossOriginPatched?: boolean }).__audioCrossOriginPatched) {
  try {
    const OriginalAudio = window.Audio
    const PatchedAudio = function (this: HTMLAudioElement, ...args: ConstructorParameters<typeof Audio>) {
      const el = new OriginalAudio(...args)
      try { el.crossOrigin = 'anonymous' } catch { /* no-op */ }
      return el
    } as unknown as typeof Audio
    PatchedAudio.prototype = OriginalAudio.prototype
    window.Audio = PatchedAudio
    ;(window as unknown as { __audioCrossOriginPatched?: boolean }).__audioCrossOriginPatched = true
    console.info('[EQ] window.Audio patched: crossOrigin=anonymous por defecto')
  } catch (err) {
    console.warn('[EQ] no se pudo parchar window.Audio:', err)
  }
}

export function usePlayout() {
  const [status, setStatus] = useState<PlayoutStatus>({
    state: 'stopped',
    profileId: null,
    track: null,
    queueIndex: 0,
    queueLength: 0,
    songsSinceLastAd: 0
  })
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<PlayoutLogEntry[]>([])
  const appendLog = useCallback((level: PlayoutLogEntry['level'], message: string) => {
    setLogs((prev) => {
      const entry: PlayoutLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        level,
        message
      }
      const next = [...prev, entry]
      return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next
    })
  }, [])
  const clearLogs = useCallback(() => setLogs([]), [])
  const [equalizer, setEqualizer] = useState<EqualizerState>(defaultEqState)
  const [customPresets, setCustomPresets] = useState<EqualizerPreset[]>([])
  const eqEnabledRef = useRef(true)
  const [nextAdCountdownSec, setNextAdCountdownSec] = useState<number | null>(null)
  const [nextAdLabel, setNextAdLabel] = useState<string>('Sin tanda programada')
  const [adBreakElapsedSec, setAdBreakElapsedSec] = useState(0)
  const [adBreakRemainingSec, setAdBreakRemainingSec] = useState<number | null>(null)
  const [adBreakName, setAdBreakName] = useState<string | null>(null)
  const [pendingAdBlock, setPendingAdBlock] = useState<{ id: string; name: string } | null>(null)
  const [currentSec, setCurrentSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [queue, setQueue] = useState<Array<{ id: string; name: string; durationMs: number | null }>>([])  
  const [volume, setVolumeState] = useState<number>(1)
  const statusRef = useRef(status)
  useEffect(() => { statusRef.current = status }, [status])
  const audioServerPortRef = useRef<number | null>(null)
  const howlRef = useRef<Howl | null>(null)
  const monitorHowlRef = useRef<Howl | null>(null)
  const transitionRef = useRef<{ fadeInMs: number; fadeOutMs: number }>({ fadeInMs: 0, fadeOutMs: 0 })
  const sinkDeviceIdRef = useRef<string | null>(null)
  const monitorSinkDeviceIdRef = useRef<string | null>(null)
  const eqCtxRef = useRef<AudioContext | null>(null)
  const eqSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const eqCapturedNodeRef = useRef<HTMLAudioElement | null>(null)
  const eqNodesRef = useRef<BiquadFilterNode[] | null>(null)
  // Cada HTMLMediaElement solo puede tener UN MediaElementSourceNode en toda su vida.
  // Howler reusa elementos del html5 pool, asi que cacheamos los sources ya creados.
  const eqSourceCacheRef = useRef<WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>>(new WeakMap())
  const timeRulesRef = useRef<TimeRule[]>([])
  const nextAdTargetRef = useRef<number | null>(null)
  const adBreakStartedAtRef = useRef<number | null>(null)
  const adBreakTotalSecRef = useRef<number | null>(null)

  useEffect(() => {
    window.electronAPI.audio.getServerPort().then((port) => {
      audioServerPortRef.current = port
    }).catch(() => {})
  }, [])

  // Ensure the filter chain exists (called lazily on first play)
  const ensureEqChain = useCallback(() => {
    if (!eqCtxRef.current) {
      // Use AudioContext sinkId option (Chromium 110+) so EQ-routed audio reaches the same
      // device the howl was sent to. Falls back to default sink if not supported.
      const sinkId = sinkDeviceIdRef.current
      try {
        eqCtxRef.current = sinkId
          ? new (AudioContext as unknown as new (opts: { sinkId: string }) => AudioContext)({ sinkId })
          : new AudioContext()
      } catch {
        eqCtxRef.current = new AudioContext()
      }
    }
    const ctx = eqCtxRef.current
    if (eqNodesRef.current) return

    // 10 bandas ISO: lowshelf en 31Hz, highshelf en 16kHz, peaking (Q de octava) en el medio.
    // Con todas las ganancias en 0 la respuesta es plana, sin coloracion ni resonancias.
    const nodes: BiquadFilterNode[] = EQ_BAND_FREQS.map((freq, idx) => {
      const f = ctx.createBiquadFilter()
      if (idx === 0) {
        f.type = 'lowshelf'
        f.frequency.value = freq
      } else if (idx === EQ_BAND_FREQS.length - 1) {
        f.type = 'highshelf'
        f.frequency.value = freq
      } else {
        f.type = 'peaking'
        f.frequency.value = freq
        f.Q.value = EQ_PEAKING_Q
      }
      f.gain.value = 0
      return f
    })

    // Conectar en serie: nodes[0] -> nodes[1] -> ... -> nodes[N-1].
    // El nodo final NO se conecta al destino aqui; lo hace applyEqRouting() segun enabled
    // (bypass real cuando esta apagado: el source va directo al destination, sin filtros).
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1])
    eqNodesRef.current = nodes
  }, [])

  // Keep the EQ AudioContext routed to the current sink device when it changes
  const updateEqSink = useCallback(async () => {
    const ctx = eqCtxRef.current
    const sinkId = sinkDeviceIdRef.current
    if (!ctx || !sinkId) return
    const ctxAny = ctx as unknown as { setSinkId?: (id: string) => Promise<void>; sinkId?: string }
    if (ctxAny.sinkId === sinkId) return
    try { await ctxAny.setSinkId?.(sinkId) } catch { /* unsupported */ }
  }, [])

  // Routing real: cuando el EQ esta apagado, el source va DIRECTO al destination y la cadena
  // de filtros queda fuera del path. Asi no queda ningun efecto residual (ni coloracion de fase,
  // ni filtros 'planos pero presentes'). Cuando se enciende, se vuelve a enrutar por la cadena.
  const applyEqRouting = useCallback(() => {
    const ctx = eqCtxRef.current
    const nodes = eqNodesRef.current
    const source = eqSourceRef.current
    if (!ctx || !nodes || !source) return
    const lastFilter = nodes[nodes.length - 1]
    // Desconectar AMBAS salidas posibles del source y del filtro final, despues reconectar segun estado.
    try { source.disconnect() } catch { /* no-op */ }
    try { lastFilter.disconnect() } catch { /* no-op */ }
    if (eqEnabledRef.current) {
      source.connect(nodes[0])
      lastFilter.connect(ctx.destination)
    } else {
      source.connect(ctx.destination)
    }
  }, [])

  // Connect a Howl's <audio> element through the EQ filter chain
  const connectHowlToEq = useCallback((howl: Howl) => {
    ensureEqChain()
    const ctx = eqCtxRef.current
    const nodes = eqNodesRef.current
    if (!ctx || !nodes) return

    const sounds = (howl as unknown as { _sounds?: Array<{ _node?: HTMLMediaElement }> })._sounds
    const audioEl = sounds?.[0]?._node as HTMLAudioElement | undefined
    if (!audioEl) {
      console.warn('[EQ] no audio element found on howl, skipping EQ connect')
      appendLog('warn', 'EQ: no se encontró elemento de audio')
      return
    }

    // Si el elemento ya estaba en uso sin crossOrigin (caso borde), forzar reload no es viable
    // sin cortar el audio. El patch global de window.Audio garantiza crossOrigin desde el inicio.
    if (!audioEl.crossOrigin) {
      try { audioEl.crossOrigin = 'anonymous' } catch { /* no-op */ }
    }

    // Si este elemento ya esta enchufado al primer nodo del EQ, no hacemos nada.
    if (eqCapturedNodeRef.current === audioEl && eqSourceRef.current) {
      if (ctx.state === 'suspended') void ctx.resume()
      applyEqRouting()
      void updateEqSink()
      return
    }

    // Desconectar el source anterior (de otro elemento) del nodo low.
    try { eqSourceRef.current?.disconnect() } catch { /* no-op */ }
    eqSourceRef.current = null

    // Reusar el source si ya capturamos este elemento antes (Howler html5 pool reciclo el <audio>).
    let source = eqSourceCacheRef.current.get(audioEl) ?? null
    let wasCached = source !== null
    if (!source) {
      try {
        source = ctx.createMediaElementSource(audioEl)
        eqSourceCacheRef.current.set(audioEl, source)
      } catch (err) {
        // InvalidStateError: el elemento ya estaba enchufado a OTRO AudioContext.
        console.error('[EQ] createMediaElementSource fallo:', err)
        appendLog('error', `EQ desconectado: ${(err as Error)?.message ?? String(err)}`)
        eqCapturedNodeRef.current = audioEl
        return
      }
    }

    try {
      eqSourceRef.current = source
      eqCapturedNodeRef.current = audioEl
      applyEqRouting()
      if (ctx.state === 'suspended') void ctx.resume()
      void updateEqSink()
      appendLog('info', wasCached ? 'EQ reconectado (cached)' : `EQ ${eqEnabledRef.current ? 'conectado' : 'en bypass'} (ctx ${ctx.state}, sr ${ctx.sampleRate})`)
    } catch (err) {
      console.error('[EQ] error connecting source to filter chain:', err)
      appendLog('error', `EQ error de conexión: ${(err as Error)?.message ?? String(err)}`)
    }
  }, [ensureEqChain, updateEqSink, appendLog, applyEqRouting])

  useEffect(() => {
    const wasEnabled = eqEnabledRef.current
    eqEnabledRef.current = equalizer.enabled
    const nodes = eqNodesRef.current
    const ctx = eqCtxRef.current
    if (!nodes || !ctx) return
    // Si cambio el flag enabled, re-rutear (bypass real cuando off).
    if (wasEnabled !== equalizer.enabled) applyEqRouting()
    // Smooth ramping (~30 ms) evita clicks al mover sliders en tiempo real.
    // Igual aplicamos las gananacias por si vuelve a encenderse: la cadena queda lista.
    const now = ctx.currentTime
    const ramp = 0.03
    for (let i = 0; i < nodes.length; i++) {
      const target = equalizer.gains[i] ?? 0
      nodes[i].gain.setTargetAtTime(target, now, ramp)
    }
  }, [equalizer, applyEqRouting])

  const applySinkToHowl = useCallback(async (howl: Howl) => {
    const targetDeviceId = sinkDeviceIdRef.current
    if (!targetDeviceId) return

    try {
      const sounds = ((howl as unknown as { _sounds?: Array<{ _node?: HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> } }> })._sounds ?? [])
      for (const sound of sounds) {
        if (sound._node?.setSinkId) {
          await sound._node.setSinkId(targetDeviceId)
        }
      }
    } catch {
      // Some environments do not allow changing output device; keep default sink silently.
    }
  }, [])

  const applyMonitorSinkToHowl = useCallback(async (howl: Howl) => {
    const targetDeviceId = monitorSinkDeviceIdRef.current
    if (!targetDeviceId) return
    try {
      const sounds = ((howl as unknown as { _sounds?: Array<{ _node?: HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> } }> })._sounds ?? [])
      for (const sound of sounds) {
        if (sound._node?.setSinkId) {
          await sound._node.setSinkId(targetDeviceId)
        }
      }
    } catch {
      // Monitor device unavailable, ignore silently.
    }
  }, [])

  const loadLocalOutput = useCallback(async (profileId: string) => {
    const outputs = await outputService.list(profileId)
    const local = outputs.find((out) => out.outputType === 'local' && out.enabled)
    if (!local) {
      sinkDeviceIdRef.current = null
      return
    }

    try {
      const cfg = JSON.parse(local.config) as LocalOutputConfig
      sinkDeviceIdRef.current = cfg.deviceId && cfg.deviceId !== 'default' ? cfg.deviceId : null
    } catch {
      sinkDeviceIdRef.current = null
    }
  }, [])

  const loadMonitorOutput = useCallback(async (profileId: string) => {
    const outputs = await outputService.list(profileId)
    const monitorOut = outputs.find((out) => out.outputType === 'monitor' && out.enabled)
    if (!monitorOut) {
      monitorSinkDeviceIdRef.current = null
      return
    }
    try {
      const cfg = JSON.parse(monitorOut.config) as LocalOutputConfig
      monitorSinkDeviceIdRef.current = cfg.deviceId && cfg.deviceId !== 'default' ? cfg.deviceId : null
    } catch {
      monitorSinkDeviceIdRef.current = null
    }
  }, [])

  const loadTimeRules = useCallback(async (profileId: string) => {
    const listFn = (window.electronAPI as unknown as { adRules?: { list?: (id: string) => Promise<AdRule[]> } }).adRules?.list
    if (!listFn) {
      timeRulesRef.current = []
      nextAdTargetRef.current = null
      setNextAdCountdownSec(null)
      setNextAdLabel('Sin tanda programada')
      return
    }

    const rules = await listFn(profileId)
    const parsedRules = rules
      .map(parseTimeRule)
      .filter((rule): rule is TimeRule => Boolean(rule))

    timeRulesRef.current = parsedRules

    const now = new Date()
    const candidates = parsedRules
      .map((rule) => getNextOccurrenceMs(now, rule))
      .filter((value): value is number => value !== null)

    const nextTarget = candidates.length ? Math.min(...candidates) : null
    nextAdTargetRef.current = nextTarget
    if (!nextTarget) {
      setNextAdCountdownSec(null)
      setNextAdLabel('Sin tanda programada')
      return
    }

    setNextAdCountdownSec(Math.max(0, Math.floor((nextTarget - now.getTime()) / 1000)))
    setNextAdLabel(new Date(nextTarget).toLocaleString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }))
  }, [])

  const playTrack = useCallback((track: AudioAsset, fadeInMs = 0) => {
    howlRef.current?.unload()
    monitorHowlRef.current?.unload()
    setCurrentSec(0)
    // Prefer the DB-probed duration (accurate for VBR MP3) over Howler's HTML5 estimate,
    // which often underestimates by 10-30 s and made the progress bar reach 100 % too early.
    const probedSec =
      track.durationMs && track.durationMs > 0 ? Math.floor(track.durationMs / 1000) : 0
    setDurationSec(probedSec)
    const src =
      track.sourceType === 'local'
        ? (() => {
            const port = audioServerPortRef.current
            const ext = track.sourcePath.split('.').pop()?.toLowerCase() ?? 'mp3'
            return port
              ? `http://127.0.0.1:${port}/audio.${ext}?p=${encodeURIComponent(track.sourcePath)}`
              : `local-audio://localhost?p=${encodeURIComponent(track.sourcePath)}`
          })()
        : track.sourcePath

    const howl = new Howl({
      src: [src],
      html5: true,
      volume: fadeInMs > 0 ? 0 : 1,
      onload: () => {
        const dur = howl.duration()
        if (typeof dur === 'number' && dur > 0 && isFinite(dur)) {
          // Only upgrade duration if the audio element reports a larger value than the
          // probed one. Never shrink: HTML5 audio under-reports VBR MP3 durations.
          setDurationSec((prev) => Math.max(prev, Math.floor(dur)))
        }
      },
      onplay: () => {
        void applySinkToHowl(howl)
        // Always pre-route through the EQ chain at track start (audio is silent
        // at this moment, no glitch). The 'enabled' state just controls gain values.
        connectHowlToEq(howl)
        // Re-read duration on play in case onload fired before metadata was ready
        const dur = howl.duration()
        if (typeof dur === 'number' && dur > 0 && isFinite(dur)) {
          setDurationSec((prev) => Math.max(prev, Math.floor(dur)))
        }
      },
      onend: () => {
        // Snap the bar to 100 % so it visually completes; the next track will reset it.
        setCurrentSec((prev) => Math.max(prev, probedSec))
        window.electronAPI.playout.next()
      },
      onloaderror: (_id: number, err: unknown) => {
        console.error('[usePlayout] onloaderror', track.name, src, err)
        setError(`No se pudo cargar: ${track.name} — ${String(err)}`)
        appendLog('error', `Error al cargar: ${track.name} — ${String(err)}`)
        window.electronAPI.playout.next()
      },
      onplayerror: (_id: number, err: unknown) => {
        console.warn('[usePlayout] onplayerror', track.name, err)
        appendLog('warn', `Reintentando reproducción: ${track.name}`)
        try {
          howl.once('unlock', () => { try { howl.play() } catch { /* no-op */ } })
        } catch { /* no-op */ }
      }
    })
    howl.play()
    if (fadeInMs > 0) {
      howl.fade(0, 1, fadeInMs)
    }
    howlRef.current = howl

    // Monitor: reproduce el mismo audio en el dispositivo de monitoreo
    if (monitorSinkDeviceIdRef.current) {
      const monitorHowl = new Howl({
        src: [src],
        html5: true,
        volume: 1,
        onplay: () => { void applyMonitorSinkToHowl(monitorHowl) }
      })
      monitorHowl.play()
      monitorHowlRef.current = monitorHowl
    } else {
      monitorHowlRef.current = null
    }
  }, [applySinkToHowl, applyMonitorSinkToHowl, connectHowlToEq])

  const isAdBreakRef = useRef(false)

  useEffect(() => {
    const onStateChanged = (data: { state: PlayoutStatus['state'] }) => {
      setStatus((prev) => ({ ...prev, state: data.state }))
      const labels: Record<PlayoutStatus['state'], string> = {
        stopped: 'Reproducción detenida',
        playing: 'Reproducción iniciada',
        paused: 'Reproducción en pausa',
        ad_break: 'Tanda publicitaria iniciada'
      }
      appendLog('info', labels[data.state] ?? `Estado: ${data.state}`)
    }
    const onTrackChanged = (data: { track: AudioAsset; queueIndex?: number; queueLength?: number }) => {
      setStatus((prev) => ({
        ...prev,
        track: data.track,
        ...(data.queueIndex !== undefined ? { queueIndex: data.queueIndex } : {}),
        ...(data.queueLength !== undefined ? { queueLength: data.queueLength } : {})
      }))
      // Don't start new music while an ad break is active
      if (isAdBreakRef.current) {
        transitionRef.current = { fadeInMs: 0, fadeOutMs: 0 }
        return
      }
      // Dedupe: if the same track is already loaded (e.g. duplicate track-changed events
      // from scheduler syncProgram or React StrictMode dual-mount), don't reload — that
      // would unload the current howl and restart playback from 0.
      const currentTrackId = statusRef.current.track?.id
      if (currentTrackId === data.track.id && howlRef.current) {
        transitionRef.current = { fadeInMs: 0, fadeOutMs: 0 }
        return
      }
      appendLog('info', `Audio: ${data.track.name}`)
      playTrack(data.track, transitionRef.current.fadeInMs)
      transitionRef.current = { fadeInMs: 0, fadeOutMs: 0 }
    }
    const onAdStart = async (rawData: unknown) => {
      // Guard against duplicate calls (React StrictMode double-mount)
      if (isAdBreakRef.current) return
      isAdBreakRef.current = true

      const data = rawData as {
        block: { id: string; name: string; items?: Array<{ audioAsset?: AudioAsset | null }> }
      }
      setStatus((prev) => ({ ...prev, state: 'ad_break' }))
      setAdBreakName(data.block.name)
      appendLog('info', `Tanda iniciada: ${data.block.name}`)
      setPendingAdBlock(null)  // clear pending notice once ad actually starts
      adBreakStartedAtRef.current = Date.now()
      const items = data.block.items ?? []
      const totalMs = items.reduce((sum, item) => sum + (item.audioAsset?.durationMs ?? 0), 0)
      adBreakTotalSecRef.current = totalMs > 0 ? Math.floor(totalMs / 1000) : null
      setAdBreakElapsedSec(0)
      setAdBreakRemainingSec(adBreakTotalSecRef.current)

      // Fade out and stop current music — do NOT rely on howl.playing()
      // because in html5+EQ mode Howler reports playing()=false even while audio is running
      const currentHowl = howlRef.current
      howlRef.current = null  // claim ref early to prevent races
      monitorHowlRef.current?.stop()
      monitorHowlRef.current?.unload()
      monitorHowlRef.current = null
      if (currentHowl) {
        try {
          currentHowl.fade(currentHowl.volume(), 0, 600)
          await new Promise<void>((res) => window.setTimeout(res, 650))
        } catch { /* fade may fail in EQ mode, continue anyway */ }
        currentHowl.stop()
        currentHowl.unload()
      }
      // Also force-pause the raw audio element captured by AudioContext (EQ workaround)
      const capturedEl = eqCapturedNodeRef.current
      if (capturedEl && !capturedEl.paused) {
        try { capturedEl.pause() } catch { /* no-op */ }
      }

      // Play each ad audio asset in sequence
      const assets = items
        .map((i) => i.audioAsset)
        .filter((a): a is AudioAsset => Boolean(a))

      const port = audioServerPortRef.current
      for (const asset of assets) {
        await new Promise<void>((resolve) => {
          const ext = asset.sourcePath.split('.').pop()?.toLowerCase() ?? 'mp3'
          const src =
            asset.sourceType === 'local' && port
              ? `http://127.0.0.1:${port}/audio.${ext}?p=${encodeURIComponent(asset.sourcePath)}`
              : asset.sourcePath

          const adHowl = new Howl({
            src: [src],
            html5: true,
            onplay: () => {
              void applySinkToHowl(adHowl)
              connectHowlToEq(adHowl)
            },
            onend: () => resolve(),
            onstop: () => resolve(),
            onloaderror: () => {
              console.error('[usePlayout] Ad track load error:', asset.name)
              resolve()
            }
          })
          adHowl.play()
          howlRef.current = adHowl
        })
      }

      // Clean up ad break refs before notifying main
      adBreakStartedAtRef.current = null
      adBreakTotalSecRef.current = null
      isAdBreakRef.current = false

      // Signal main process that ad break is done
      try {
        await window.electronAPI.playout.adEndAck()
      } catch {
        // ignore
      }
    }

    const onProgramChanged = async (data: {
      program: { profileId: string; playlistId?: string | null }
      transition?: { fadeInMs?: number; fadeOutMs?: number }
    }) => {
      if (statusRef.current.state !== 'playing') return
      if (statusRef.current.profileId !== data.program.profileId) return

      const fadeOutMs = data.transition?.fadeOutMs ?? 1000
      const fadeInMs = data.transition?.fadeInMs ?? 1000

      const currentHowl = howlRef.current
      if (currentHowl?.playing()) {
        try {
          currentHowl.fade(currentHowl.volume(), 0, fadeOutMs)
          window.setTimeout(() => currentHowl.stop(), fadeOutMs + 40)
        } catch {
          currentHowl.stop()
        }
      }

      transitionRef.current = { fadeInMs, fadeOutMs }
      await playoutService.syncProgram(data.program.profileId, data.program.playlistId ?? null)
    }

    const onQueueUpdate = (data: { queue: Array<{ id: string; name: string; durationMs: number | null }>; queueIndex: number }) => {
      setQueue(data.queue)
      setStatus((prev) => ({ ...prev, queueIndex: data.queueIndex }))
    }

    const onAdEnd = () => {
      setAdBreakName(null)
      adBreakStartedAtRef.current = null
      adBreakTotalSecRef.current = null
      setAdBreakElapsedSec(0)
      setAdBreakRemainingSec(null)
      appendLog('info', 'Tanda finalizada')
    }

    const onAdPending = (data: unknown) => {
      const d = data as { adBlockId: string; name: string }
      setPendingAdBlock({ id: d.adBlockId, name: d.name })
      appendLog('info', `Tanda programada: ${d.name}`)
    }

    window.electronAPI.on('playout:state-changed', onStateChanged as (...args: unknown[]) => void)
    window.electronAPI.on('playout:track-changed', onTrackChanged as (...args: unknown[]) => void)
    window.electronAPI.on('playout:ad-start', onAdStart as (...args: unknown[]) => void)
    window.electronAPI.on('playout:ad-end', onAdEnd as (...args: unknown[]) => void)
    window.electronAPI.on('playout:ad-pending', onAdPending as (...args: unknown[]) => void)
    window.electronAPI.on('scheduler:program-changed', onProgramChanged as (...args: unknown[]) => void)
    window.electronAPI.on('playout:queue-update', onQueueUpdate as (...args: unknown[]) => void)

    return () => {
      window.electronAPI.off('playout:state-changed', onStateChanged as (...args: unknown[]) => void)
      window.electronAPI.off('playout:track-changed', onTrackChanged as (...args: unknown[]) => void)
      window.electronAPI.off('playout:ad-start', onAdStart as (...args: unknown[]) => void)
      window.electronAPI.off('playout:ad-end', onAdEnd as (...args: unknown[]) => void)
      window.electronAPI.off('playout:ad-pending', onAdPending as (...args: unknown[]) => void)
      window.electronAPI.off('scheduler:program-changed', onProgramChanged as (...args: unknown[]) => void)
      window.electronAPI.off('playout:queue-update', onQueueUpdate as (...args: unknown[]) => void)
    }
  }, [playTrack, applySinkToHowl, connectHowlToEq])

  useEffect(() => {
    if (!status.profileId) return
    void loadTimeRules(status.profileId)
  }, [loadTimeRules, status.profileId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nowMs = Date.now()
      const currentStatus = statusRef.current

      const nextTarget = nextAdTargetRef.current
      if (nextTarget) {
        const left = Math.max(0, Math.floor((nextTarget - nowMs) / 1000))
        setNextAdCountdownSec(left)
        if (left <= 0 && currentStatus.profileId) {
          void loadTimeRules(currentStatus.profileId)
        }
      }

      if (currentStatus.state === 'ad_break' && adBreakStartedAtRef.current) {
        const elapsed = Math.max(0, Math.floor((nowMs - adBreakStartedAtRef.current) / 1000))
        setAdBreakElapsedSec(elapsed)
        if (adBreakTotalSecRef.current !== null) {
          setAdBreakRemainingSec(Math.max(0, adBreakTotalSecRef.current - elapsed))
        }
      } else {
        adBreakStartedAtRef.current = null
        adBreakTotalSecRef.current = null
        setAdBreakName(null)
        setAdBreakElapsedSec(0)
        setAdBreakRemainingSec(null)
      }

      // Actualizar posición del track actual
      // Leer directamente del <audio> para no depender de playing() de Howler,
      // que puede devolver false cuando el elemento fue capturado por AudioContext.
      if (howlRef.current && currentStatus.state === 'playing') {
        const sounds = (howlRef.current as unknown as { _sounds?: Array<{ _node?: HTMLAudioElement }> })._sounds
        const audioEl = sounds?.[0]?._node
        if (audioEl) {
          // Promote duration if the element finally knows a larger value than what we have.
          const elDur = audioEl.duration
          if (typeof elDur === 'number' && isFinite(elDur) && elDur > 0) {
            setDurationSec((prev) => Math.max(prev, Math.floor(elDur)))
          }
          if (audioEl.ended) {
            // Audio finished but onend may not have fired yet — keep the bar at the end.
            setCurrentSec((prev) => Math.max(prev, Math.floor(audioEl.duration || prev)))
          } else {
            setCurrentSec(Math.floor(audioEl.currentTime))
          }
        }
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [loadTimeRules])

  const start = useCallback(async (profileId: string, playlistId?: string, startIndex?: number) => {
    setError(null)
    try {
      await loadLocalOutput(profileId)
      await loadMonitorOutput(profileId)
      await loadTimeRules(profileId)
      const st = await playoutService.start(profileId, playlistId, startIndex)
      setStatus(st)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar')
    }
  }, [loadLocalOutput, loadMonitorOutput, loadTimeRules])

  const stop = useCallback(async () => {
    howlRef.current?.unload()
    monitorHowlRef.current?.unload()
    setCurrentSec(0)
    setDurationSec(0)
    await playoutService.stop()
  }, [])

  const pause = useCallback(() => {
    howlRef.current?.pause()
    monitorHowlRef.current?.pause()
    playoutService.pause()
  }, [])

  const resume = useCallback(() => {
    howlRef.current?.play()
    monitorHowlRef.current?.play()
    playoutService.resume()
  }, [])

  const prev = useCallback(() => {
    howlRef.current?.stop()
    monitorHowlRef.current?.stop()
    playoutService.prev()
  }, [])

  const next = useCallback(() => {
    howlRef.current?.stop()
    monitorHowlRef.current?.stop()
    playoutService.next()
  }, [])

  const jumpTo = useCallback((index: number) => {
    howlRef.current?.stop()
    monitorHowlRef.current?.stop()
    playoutService.jumpTo(index)
  }, [])

  const seek = useCallback((sec: number) => {
    howlRef.current?.seek(sec)
    monitorHowlRef.current?.seek(sec)
    setCurrentSec(sec)
  }, [])

  const triggerAdBlock = useCallback(async (adBlockId: string) => {
    await playoutService.triggerAdBlock(adBlockId)
  }, [])

  const changePlaylist = useCallback(async (profileId: string, playlistId: string | null) => {
    const currentHowl = howlRef.current
    if (currentHowl?.playing()) {
      currentHowl.fade(currentHowl.volume(), 0, 800)
      await new Promise<void>((res) => window.setTimeout(res, 850))
      currentHowl.stop()
    }
    monitorHowlRef.current?.stop()
    setCurrentSec(0)
    setDurationSec(0)
    await playoutService.syncProgram(profileId, playlistId)
  }, [])

  const setEqualizerBand = useCallback((bandIndex: number, value: number) => {
    if (!Number.isInteger(bandIndex) || bandIndex < 0 || bandIndex >= EQ_BANDS_COUNT) return
    const v = clampGain(value)
    setEqualizer((prev) => {
      const next = prev.gains.slice()
      next[bandIndex] = v
      return { ...prev, gains: next, presetId: 'custom' }
    })
  }, [])

  const toggleEqualizer = useCallback((enabled: boolean) => {
    setEqualizer((prev) => ({ ...prev, enabled }))
  }, [])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    Howler.volume(clamped)
    setVolumeState(clamped)
  }, [])

  const resetEqualizer = useCallback(() => {
    setEqualizer((prev) => ({ enabled: prev.enabled, gains: new Array(EQ_BANDS_COUNT).fill(0), presetId: 'flat' }))
  }, [])

  const allEqPresets = useCallback((): EqualizerPreset[] => {
    return [...BUILT_IN_EQ_PRESETS, ...customPresets]
  }, [customPresets])

  const applyEqualizerPreset = useCallback((presetId: string) => {
    const all = [...BUILT_IN_EQ_PRESETS, ...customPresets]
    const preset = all.find((p) => p.id === presetId)
    if (!preset) return
    setEqualizer((prev) => ({ ...prev, gains: normalizeGains(preset.gains), presetId: preset.id }))
  }, [customPresets])

  const saveEqualizerPreset = useCallback((name: string): { ok: boolean; error?: string; id?: string } => {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'El nombre no puede estar vacío' }
    const all = [...BUILT_IN_EQ_PRESETS, ...customPresets]
    if (all.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Ya existe un preset con ese nombre' }
    }
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newPreset: EqualizerPreset = { id, name: trimmed, gains: equalizer.gains.slice(), builtIn: false }
    setCustomPresets((prev) => [...prev, newPreset])
    setEqualizer((prev) => ({ ...prev, presetId: id }))
    return { ok: true, id }
  }, [customPresets, equalizer.gains])

  const deleteEqualizerPreset = useCallback((presetId: string): { ok: boolean; error?: string } => {
    if (BUILT_IN_EQ_PRESETS.some((p) => p.id === presetId)) {
      return { ok: false, error: 'No se pueden eliminar presets built-in' }
    }
    setCustomPresets((prev) => prev.filter((p) => p.id !== presetId))
    setEqualizer((prev) => prev.presetId === presetId ? { ...prev, presetId: 'custom' } : prev)
    return { ok: true }
  }, [])

  // Persistencia: cargar al cambiar de Perfil, guardar al cambiar EQ/customs
  useEffect(() => {
    const profileId = status.profileId
    if (!profileId) return
    const persisted = loadPersistedEq(profileId)
    if (persisted) {
      setEqualizer({ enabled: persisted.enabled, gains: persisted.gains, presetId: persisted.presetId })
      setCustomPresets(persisted.customPresets)
    } else {
      setEqualizer(defaultEqState())
      setCustomPresets([])
    }
  }, [status.profileId])

  useEffect(() => {
    const profileId = status.profileId
    if (!profileId) return
    savePersistedEq(profileId, {
      enabled: equalizer.enabled,
      presetId: equalizer.presetId,
      gains: equalizer.gains,
      customPresets
    })
  }, [status.profileId, equalizer, customPresets])

  return {
    status,
    queue,
    error,
    start,
    stop,
    pause,
    resume,
    prev,
    next,
    jumpTo,
    seek,
    currentSec,
    durationSec,
    triggerAdBlock,
    changePlaylist,
    adBreakTimer: {
      name: adBreakName,
      elapsedLabel: formatHms(adBreakElapsedSec),
      remainingLabel: adBreakRemainingSec !== null ? formatHms(adBreakRemainingSec) : '—'
    },
    pendingAdBlock,
    nextAd: {
      countdownLabel: nextAdCountdownSec !== null ? formatHms(nextAdCountdownSec) : '—',
      atLabel: nextAdLabel
    },
    equalizer,
    equalizerFrequencies: EQ_BAND_FREQS,
    equalizerPresets: allEqPresets(),
    setEqualizerBand,
    toggleEqualizer,
    resetEqualizer,
    applyEqualizerPreset,
    saveEqualizerPreset,
    deleteEqualizerPreset,
    volume,
    setVolume,
    logs,
    clearLogs
  }
}
