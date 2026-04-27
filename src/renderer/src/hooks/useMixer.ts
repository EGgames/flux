import { useCallback, useEffect, useRef, useState } from 'react'
import { Howl } from 'howler'
import type { AudioAsset, OutputIntegration } from '@renderer/types/ipc.types'

export type DeckId = 'A' | 'B'

export interface DeckState {
  asset: AudioAsset | null
  playing: boolean
  cued: boolean
  volume: number
  durationSec: number
  positionSec: number
}

const initialDeck = (): DeckState => ({
  asset: null,
  playing: false,
  cued: false,
  volume: 1,
  durationSec: 0,
  positionSec: 0
})

interface LocalOutputCfg {
  deviceId?: string
}

/**
 * Curva equal-power para crossfader. pos en [-1, +1].
 * gainA(pos) = cos((pos+1) * pi/4) ; gainB(pos) = sin((pos+1) * pi/4)
 * En -1 → A=1, B=0. En 0 → A=B≈0.707. En +1 → A=0, B=1.
 */
function crossfaderGain(pos: number): { A: number; B: number } {
  const clamped = Math.max(-1, Math.min(1, pos))
  const t = ((clamped + 1) * Math.PI) / 4
  return { A: Math.cos(t), B: Math.sin(t) }
}

export function useMixer(profileId: string | null) {
  const [decks, setDecks] = useState<{ A: DeckState; B: DeckState }>({
    A: initialDeck(),
    B: initialDeck()
  })
  const [crossfaderPos, setCrossfaderPos] = useState(0)
  const [monitorAvailable, setMonitorAvailable] = useState(false)
  const [monitorDeviceId, setMonitorDeviceId] = useState<string | null>(null)

  const howlRefs = useRef<{ A: Howl | null; B: Howl | null }>({ A: null, B: null })
  const audioServerPortRef = useRef<number | null>(null)
  const monitorDeviceIdRef = useRef<string | null>(null)
  const mainDeviceIdRef = useRef<string | null>('default')
  // Scratch seek throttling por deck. HTML5 <audio> NO banca 60 seeks/seg
  // (cada uno reabre buffering y el elemento se cuelga en estado `seeking`).
  // Hacemos un seek real maximo cada SCRATCH_THROTTLE_MS y un flush final
  // en flushScratch cuando el usuario suelta el platter.
  // dirty[deck]=true → en el gesto actual hubo al menos un scratchDeck()
  // y por tanto scratchPosRef tiene una posicion valida que aplicar en
  // flushScratch (sin esto un tap accidental seekearia a 0 stale).
  const scratchPosRef = useRef<{ A: number; B: number }>({ A: 0, B: 0 })
  const scratchTimerRef = useRef<{ A: number | null; B: number | null }>({ A: null, B: null })
  const scratchLastSeekAtRef = useRef<{ A: number; B: number }>({ A: 0, B: 0 })
  const scratchDirtyRef = useRef<{ A: boolean; B: boolean }>({ A: false, B: false })
  const SCRATCH_THROTTLE_MS = 250
  const tickRef = useRef<number | null>(null)

  useEffect(() => {
    const api = window.electronAPI as typeof window.electronAPI | undefined
    if (!api?.audio?.getServerPort) return
    api.audio.getServerPort().then((p) => {
      audioServerPortRef.current = p
    }).catch(() => {})
  }, [])

  // Carga devices del profile (monitor + main)
  useEffect(() => {
    if (!profileId) {
      monitorDeviceIdRef.current = null
      setMonitorAvailable(false)
      setMonitorDeviceId(null)
      return
    }
    const load = async (): Promise<void> => {
      try {
        const api = window.electronAPI as typeof window.electronAPI | undefined
        if (!api?.outputs?.list) {
          setMonitorAvailable(false)
          return
        }
        const outputs: OutputIntegration[] = await api.outputs.list(profileId)
        const monitor = outputs.find((o) => o.outputType === 'monitor' && o.enabled)
        const main = outputs.find((o) => o.outputType === 'local' && o.enabled)
        if (monitor) {
          try {
            const cfg = JSON.parse(monitor.config) as LocalOutputCfg
            monitorDeviceIdRef.current = cfg.deviceId || null
          } catch {
            monitorDeviceIdRef.current = null
          }
        } else {
          monitorDeviceIdRef.current = null
        }
        if (main) {
          try {
            const cfg = JSON.parse(main.config) as LocalOutputCfg
            mainDeviceIdRef.current = cfg.deviceId || 'default'
          } catch {
            mainDeviceIdRef.current = 'default'
          }
        }
        setMonitorAvailable(Boolean(monitorDeviceIdRef.current))
        setMonitorDeviceId(monitorDeviceIdRef.current)
      } catch {
        setMonitorAvailable(false)
        setMonitorDeviceId(null)
      }
    }
    void load()
    const handler = (): void => { void load() }
    window.addEventListener('flux:outputs-changed', handler)
    return () => window.removeEventListener('flux:outputs-changed', handler)
  }, [profileId])

  const applySinkId = useCallback(async (howl: Howl, deviceId: string): Promise<void> => {
    const sounds = (howl as unknown as {
      _sounds?: Array<{ _node?: HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> } }>
    })._sounds ?? []
    for (const s of sounds) {
      const node = s._node
      if (node?.setSinkId) {
        try { await node.setSinkId(deviceId) } catch { /* no-op */ }
      }
    }
  }, [])

  // Recalcula volumen efectivo de cada howl segun posicion del crossfader y cue.
  const applyVolumes = useCallback((pos: number, state: { A: DeckState; B: DeckState }) => {
    const gains = crossfaderGain(pos)
    const a = howlRefs.current.A
    const b = howlRefs.current.B
    if (a) {
      // En cue, el deck se enruta al monitor y NO entra al crossfader (suena solo en monitor a su volumen).
      const v = state.A.cued ? state.A.volume : state.A.volume * gains.A
      try { a.volume(Math.max(0, Math.min(1, v))) } catch { /* no-op */ }
    }
    if (b) {
      const v = state.B.cued ? state.B.volume : state.B.volume * gains.B
      try { b.volume(Math.max(0, Math.min(1, v))) } catch { /* no-op */ }
    }
  }, [])

  const loadAsset = useCallback((deck: DeckId, asset: AudioAsset): void => {
    // Unload previous
    const prev = howlRefs.current[deck]
    if (prev) {
      try { prev.stop() } catch { /* no-op */ }
      try { prev.unload() } catch { /* no-op */ }
    }
    const port = audioServerPortRef.current
    const ext = asset.sourcePath.split('.').pop()?.toLowerCase() ?? 'mp3'
    const src =
      asset.sourceType === 'local' && port
        ? `http://127.0.0.1:${port}/audio.${ext}?p=${encodeURIComponent(asset.sourcePath)}`
        : asset.sourcePath
    const howl = new Howl({
      src: [src],
      html5: true,
      volume: 0,
      onload: () => {
        const dur = howl.duration()
        setDecks((prev2) => ({
          ...prev2,
          [deck]: { ...prev2[deck], durationSec: typeof dur === 'number' && isFinite(dur) ? dur : 0 }
        }))
      },
      onend: () => {
        setDecks((prev2) => ({ ...prev2, [deck]: { ...prev2[deck], playing: false, positionSec: 0 } }))
      }
    })
    howlRefs.current[deck] = howl
    setDecks((prev2) => ({
      ...prev2,
      [deck]: {
        ...prev2[deck],
        asset,
        playing: false,
        positionSec: 0,
        durationSec: asset.durationMs ? Math.floor(asset.durationMs / 1000) : 0
      }
    }))
  }, [])

  const playPause = useCallback((deck: DeckId): void => {
    const howl = howlRefs.current[deck]
    if (!howl) return
    setDecks((prev) => {
      const isPlaying = prev[deck].playing
      if (isPlaying) {
        try { howl.pause() } catch { /* no-op */ }
      } else {
        try { howl.play() } catch { /* no-op */ }
        // Aplicar sink correcto al iniciar
        const targetDevice = prev[deck].cued
          ? (monitorDeviceIdRef.current ?? 'default')
          : (mainDeviceIdRef.current ?? 'default')
        void applySinkId(howl, targetDevice)
      }
      const next = { ...prev, [deck]: { ...prev[deck], playing: !isPlaying } }
      applyVolumes(crossfaderPos, next)
      return next
    })
  }, [applySinkId, applyVolumes, crossfaderPos])

  const setCrossfader = useCallback((pos: number): void => {
    const clamped = Math.max(-1, Math.min(1, pos))
    setCrossfaderPos(clamped)
    setDecks((prev) => {
      applyVolumes(clamped, prev)
      return prev
    })
  }, [applyVolumes])

  const setDeckVolume = useCallback((deck: DeckId, vol: number): void => {
    const v = Math.max(0, Math.min(1, vol))
    setDecks((prev) => {
      const next = { ...prev, [deck]: { ...prev[deck], volume: v } }
      applyVolumes(crossfaderPos, next)
      return next
    })
  }, [applyVolumes, crossfaderPos])

  const toggleCue = useCallback((deck: DeckId): void => {
    if (!monitorDeviceIdRef.current) return
    const howl = howlRefs.current[deck]
    setDecks((prev) => {
      const wasCued = prev[deck].cued
      const next = { ...prev, [deck]: { ...prev[deck], cued: !wasCued } }
      if (howl) {
        const targetDevice = !wasCued
          ? (monitorDeviceIdRef.current ?? 'default')
          : (mainDeviceIdRef.current ?? 'default')
        void applySinkId(howl, targetDevice)
      }
      applyVolumes(crossfaderPos, next)
      return next
    })
  }, [applySinkId, applyVolumes, crossfaderPos])

  const unloadAll = useCallback((): void => {
    for (const id of ['A', 'B'] as const) {
      const h = howlRefs.current[id]
      if (h) {
        try { h.stop() } catch { /* no-op */ }
        try { h.unload() } catch { /* no-op */ }
      }
      howlRefs.current[id] = null
      const t = scratchTimerRef.current[id]
      if (t !== null) {
        clearTimeout(t)
        scratchTimerRef.current[id] = null
      }
      scratchDirtyRef.current[id] = false
      scratchLastSeekAtRef.current[id] = 0
    }
    setDecks({ A: initialDeck(), B: initialDeck() })
    setCrossfaderPos(0)
  }, [])

  // Scratch / jog: aplica un delta de segundos al deck (positivo = avanzar, negativo = rebobinar).
  // Usado por el platter arrastrable. No depende de playing: si esta pausado igual permite buscar.
  const scratchDeck = useCallback((deck: DeckId, deltaSec: number): void => {
    const howl = howlRefs.current[deck]
    if (!howl) return
    try {
      // En el primer delta del gesto sincronizamos la posicion logica con
      // la real del howl. Usamos !dirty como senal de "primer delta".
      if (!scratchDirtyRef.current[deck]) {
        const cur = howl.seek() as number
        if (typeof cur !== 'number' || !isFinite(cur)) return
        scratchPosRef.current[deck] = cur
        scratchLastSeekAtRef.current[deck] = performance.now()
      }
      const dur = (howl.duration() as number) || 0
      const target = scratchPosRef.current[deck] + deltaSec
      // Clamp con margen del final: tocar exactamente `duration` con seek
      // dispara `onend` de Howler mid-scratch (track salta o se descarga).
      const safeMax = dur > 0 ? Math.max(0, dur - 0.25) : 0
      const next = dur > 0 ? Math.max(0, Math.min(safeMax, target)) : Math.max(0, target)
      scratchPosRef.current[deck] = next
      scratchDirtyRef.current[deck] = true
      // Update visual de posicion sincrono.
      setDecks((prev) => ({ ...prev, [deck]: { ...prev[deck], positionSec: next } }))

      // Throttle de seeks reales: como mucho 1 cada SCRATCH_THROTTLE_MS.
      const now = performance.now()
      const sinceLast = now - scratchLastSeekAtRef.current[deck]
      if (sinceLast >= SCRATCH_THROTTLE_MS && scratchTimerRef.current[deck] === null) {
        scratchLastSeekAtRef.current[deck] = now
        try { howl.seek(scratchPosRef.current[deck]) } catch { /* no-op */ }
        return
      }
      if (scratchTimerRef.current[deck] !== null) return
      const wait = Math.max(16, SCRATCH_THROTTLE_MS - sinceLast)
      scratchTimerRef.current[deck] = window.setTimeout(() => {
        scratchTimerRef.current[deck] = null
        scratchLastSeekAtRef.current[deck] = performance.now()
        const h = howlRefs.current[deck]
        if (!h) return
        try { h.seek(scratchPosRef.current[deck]) } catch { /* no-op */ }
      }, wait)
    } catch { /* no-op */ }
  }, [])

  // Aplica el seek pendiente del deck (cancela timer). Se llama al soltar el platter
  // para que la reproduccion arranque exactamente desde la posicion final.
  // Si en el gesto no hubo scratch real (tap sin movimiento), NO seekeamos:
  // hacerlo podria mandar el deck a la posicion 0 (ref stale) y silenciar el audio.
  const flushScratch = useCallback((deck: DeckId): void => {
    const t = scratchTimerRef.current[deck]
    if (t !== null) {
      clearTimeout(t)
      scratchTimerRef.current[deck] = null
    }
    const wasDirty = scratchDirtyRef.current[deck]
    scratchDirtyRef.current[deck] = false
    scratchLastSeekAtRef.current[deck] = 0
    if (!wasDirty) return
    const howl = howlRefs.current[deck]
    if (!howl) return
    try { howl.seek(scratchPosRef.current[deck]) } catch { /* no-op */ }
  }, [])

  // Tick para actualizar posicion
  useEffect(() => {
    tickRef.current = window.setInterval(() => {
      setDecks((prev) => {
        const next = { ...prev }
        let changed = false
        for (const id of ['A', 'B'] as const) {
          const h = howlRefs.current[id]
          if (!h || !prev[id].playing) continue
          try {
            const sec = h.seek() as number
            if (typeof sec === 'number' && isFinite(sec) && Math.floor(sec) !== Math.floor(prev[id].positionSec)) {
              next[id] = { ...prev[id], positionSec: sec }
              changed = true
            }
          } catch { /* no-op */ }
        }
        return changed ? next : prev
      })
    }, 500)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { unloadAll() }
  }, [unloadAll])

  return {
    decks,
    crossfaderPos,
    monitorAvailable,
    monitorDeviceId,
    loadAsset,
    playPause,
    setCrossfader,
    setDeckVolume,
    toggleCue,
    scratchDeck,
    flushScratch,
    unloadAll
  }
}
