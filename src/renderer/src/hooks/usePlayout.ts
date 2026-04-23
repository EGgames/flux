import { useState, useEffect, useCallback, useRef } from 'react'
import { Howl, Howler } from 'howler'
import type { PlayoutStatus, AudioAsset, AdRule } from '../types/ipc.types'
import { playoutService } from '../services/playoutService'
import { outputService } from '../services/outputService'

interface LocalOutputConfig {
  deviceId?: string
  deviceName?: string
}

interface EqualizerState {
  enabled: boolean
  low: number
  mid: number
  high: number
}

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
  const [equalizer, setEqualizer] = useState<EqualizerState>({
    enabled: true,
    low: 0,
    mid: 0,
    high: 0
  })
  const [nextAdCountdownSec, setNextAdCountdownSec] = useState<number | null>(null)
  const [nextAdLabel, setNextAdLabel] = useState<string>('Sin tanda programada')
  const [adBreakElapsedSec, setAdBreakElapsedSec] = useState(0)
  const [adBreakRemainingSec, setAdBreakRemainingSec] = useState<number | null>(null)
  const [adBreakName, setAdBreakName] = useState<string | null>(null)
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
  const eqNodesRef = useRef<{
    low: BiquadFilterNode
    mid: BiquadFilterNode
    high: BiquadFilterNode
  } | null>(null)
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
      eqCtxRef.current = new AudioContext()
    }
    const ctx = eqCtxRef.current
    if (eqNodesRef.current) return

    const low = ctx.createBiquadFilter()
    low.type = 'lowshelf'
    low.frequency.value = 120

    const mid = ctx.createBiquadFilter()
    mid.type = 'peaking'
    mid.frequency.value = 1000
    mid.Q.value = 1

    const high = ctx.createBiquadFilter()
    high.type = 'highshelf'
    high.frequency.value = 4500

    low.connect(mid)
    mid.connect(high)
    high.connect(ctx.destination)
    eqNodesRef.current = { low, mid, high }
  }, [])

  // Connect a Howl's <audio> element through the EQ filter chain
  const connectHowlToEq = useCallback((howl: Howl) => {
    ensureEqChain()
    const ctx = eqCtxRef.current
    const nodes = eqNodesRef.current
    if (!ctx || !nodes) return

    // Disconnect previous source
    try { eqSourceRef.current?.disconnect() } catch { /* no-op */ }
    eqSourceRef.current = null

    const sounds = (howl as unknown as { _sounds?: Array<{ _node?: HTMLMediaElement }> })._sounds
    const audioEl = sounds?.[0]?._node as HTMLAudioElement | undefined
    if (!audioEl) return

    try {
      const source = ctx.createMediaElementSource(audioEl)
      source.connect(nodes.low)
      eqSourceRef.current = source
      if (ctx.state === 'suspended') void ctx.resume()
    } catch {
      // createMediaElementSource may throw if element is already captured
    }
  }, [ensureEqChain])

  useEffect(() => {
    const nodes = eqNodesRef.current
    if (!nodes) return

    const multiplier = equalizer.enabled ? 1 : 0
    nodes.low.gain.value = equalizer.low * multiplier
    nodes.mid.gain.value = equalizer.mid * multiplier
    nodes.high.gain.value = equalizer.high * multiplier
  }, [equalizer])

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
    setDurationSec(0)
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
          setDurationSec(Math.floor(dur))
        }
      },
      onplay: () => {
        void applySinkToHowl(howl)
        connectHowlToEq(howl)
        // Re-read duration on play in case onload fired before metadata was ready
        const dur = howl.duration()
        if (typeof dur === 'number' && dur > 0 && isFinite(dur)) {
          setDurationSec(Math.floor(dur))
        }
      },
      onend: () => {
        setCurrentSec(0)
        window.electronAPI.playout.next()
      },
      onloaderror: (_id: number, err: unknown) => {
        console.error('[usePlayout] onloaderror', track.name, src, err)
        setError(`No se pudo cargar: ${track.name} — ${String(err)}`)
        window.electronAPI.playout.next()
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

  useEffect(() => {
    // Listen for state changes from Main Process
    const onStateChanged = (data: { state: PlayoutStatus['state'] }) => {
      setStatus((prev) => ({ ...prev, state: data.state }))
    }
    const onTrackChanged = (data: { track: AudioAsset; queueIndex?: number; queueLength?: number }) => {
      setStatus((prev) => ({
        ...prev,
        track: data.track,
        ...(data.queueIndex !== undefined ? { queueIndex: data.queueIndex } : {}),
        ...(data.queueLength !== undefined ? { queueLength: data.queueLength } : {})
      }))
      playTrack(data.track, transitionRef.current.fadeInMs)
      transitionRef.current = { fadeInMs: 0, fadeOutMs: 0 }
    }
    const onAdStart = async (rawData: unknown) => {
      const data = rawData as {
        block: { id: string; name: string; items?: Array<{ audioAsset?: AudioAsset | null }> }
      }
      setStatus((prev) => ({ ...prev, state: 'ad_break' }))
      setAdBreakName(data.block.name)
      adBreakStartedAtRef.current = Date.now()
      const items = data.block.items ?? []
      const totalMs = items.reduce((sum, item) => sum + (item.audioAsset?.durationMs ?? 0), 0)
      adBreakTotalSecRef.current = totalMs > 0 ? Math.floor(totalMs / 1000) : null
      setAdBreakElapsedSec(0)
      setAdBreakRemainingSec(adBreakTotalSecRef.current)

      // Fade out and stop current music
      const currentHowl = howlRef.current
      if (currentHowl?.playing()) {
        currentHowl.fade(currentHowl.volume(), 0, 600)
        await new Promise<void>((res) => window.setTimeout(res, 650))
        currentHowl.stop()
      }
      howlRef.current?.unload()
      howlRef.current = null
      monitorHowlRef.current?.unload()
      monitorHowlRef.current = null

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
    }

    window.electronAPI.on('playout:state-changed', onStateChanged as (...args: unknown[]) => void)
    window.electronAPI.on('playout:track-changed', onTrackChanged as (...args: unknown[]) => void)
    window.electronAPI.on('playout:ad-start', onAdStart as (...args: unknown[]) => void)
    window.electronAPI.on('playout:ad-end', onAdEnd as (...args: unknown[]) => void)
    window.electronAPI.on('scheduler:program-changed', onProgramChanged as (...args: unknown[]) => void)
    window.electronAPI.on('playout:queue-update', onQueueUpdate as (...args: unknown[]) => void)

    return () => {
      window.electronAPI.off('playout:state-changed', onStateChanged as (...args: unknown[]) => void)
      window.electronAPI.off('playout:track-changed', onTrackChanged as (...args: unknown[]) => void)
      window.electronAPI.off('playout:ad-start', onAdStart as (...args: unknown[]) => void)
      window.electronAPI.off('playout:ad-end', onAdEnd as (...args: unknown[]) => void)
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
      if (howlRef.current?.playing()) {
        const pos = howlRef.current.seek()
        if (typeof pos === 'number') setCurrentSec(Math.floor(pos))
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

  const setEqualizerBand = useCallback((band: 'low' | 'mid' | 'high', value: number) => {
    setEqualizer((prev) => ({ ...prev, [band]: value }))
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
    setEqualizer({ enabled: true, low: 0, mid: 0, high: 0 })
  }, [])

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
    adBreakTimer: {
      name: adBreakName,
      elapsedLabel: formatHms(adBreakElapsedSec),
      remainingLabel: adBreakRemainingSec !== null ? formatHms(adBreakRemainingSec) : '—'
    },
    nextAd: {
      countdownLabel: nextAdCountdownSec !== null ? formatHms(nextAdCountdownSec) : '—',
      atLabel: nextAdLabel
    },
    equalizer,
    setEqualizerBand,
    toggleEqualizer,
    resetEqualizer,
    volume,
    setVolume
  }
}
