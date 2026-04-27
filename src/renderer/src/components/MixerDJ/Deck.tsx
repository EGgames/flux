import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioAsset } from '@renderer/types/ipc.types'
import type { DeckState } from '@renderer/hooks/useMixer'
import { startScratch, stopScratch, updateScratch } from './scratchSound'
import styles from './MixerDJ.module.css'

interface DeckProps {
  id: 'A' | 'B'
  state: DeckState
  monitorAvailable: boolean
  assets: AudioAsset[]
  onLoad: (asset: AudioAsset) => void
  onPlayPause: () => void
  onToggleCue: () => void
  onVolume: (v: number) => void
  /**
   * Modo live: el deck es un visor read-only del tema que esta sonando en
   * la playlist principal. Los controles quedan deshabilitados.
   */
  live?: boolean
  /**
   * Callback de scratch/jog. Recibe delta en segundos: positivo = avanzar,
   * negativo = rebobinar. Si se omite, el platter no acepta drag.
   */
  onScratch?: (deltaSec: number) => void
  /** Disparado en pointerdown sobre el platter (antes del primer delta). */
  onScratchStart?: () => void
  /** Disparado al soltar/cancelar el platter (debe aplicar el seek final). */
  onScratchEnd?: () => void
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}

// Una vuelta completa del disco equivale a estos segundos de audio (vinilo @ 33 1/3 rpm = 1.8s).
const SECONDS_PER_REVOLUTION = 1.8

export default function Deck({
  id, state, monitorAvailable, assets, onLoad, onPlayPause, onToggleCue, onVolume, live = false, onScratch, onScratchStart, onScratchEnd
}: DeckProps) {
  // Progreso normalizado [0..1] para el anillo exterior del platter.
  const progress = state.durationSec > 0
    ? Math.min(1, Math.max(0, state.positionSec / state.durationSec))
    : 0
  const ringDash = 2 * Math.PI * 78 // r=78 en el SVG
  const ringOffset = ringDash * (1 - progress)

  // Scratch / jog state.
  const platterRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    pointerId: number
    centerX: number
    centerY: number
    lastAngle: number
    lastTime: number
    rotation: number // grados acumulados visuales
    /** true cuando ya hubo movimiento real (no es solo un tap). */
    moved: boolean
    /** signo del ultimo delta angular procesado (-1, 0, 1). Usado para
     *  desambiguar el wrap-around cuando el usuario gira muy rapido. */
    lastDeltaSign: -1 | 0 | 1
  } | null>(null)
  const [dragRotation, setDragRotation] = useState<number | null>(null)
  const scratchEnabled = Boolean(onScratch)
  // Umbral minimo de movimiento para considerar que el usuario inicio un
  // gesto de scratch. Por debajo lo tratamos como tap accidental y NO
  // emitimos onScratchStart/onScratchEnd ni hacemos seek (un seek a la
  // posicion inicial del tap puede silenciar el audio hasta el siguiente
  // adelanto manual). Equivale a ~5 grados de giro del platter.
  const SCRATCH_MOVE_THRESHOLD_RAD = 0.087
  // Cap absoluto del delta angular por evento de pointermove. Mas de una
  // vuelta entera (2π) entre dos eventos significa que el evento llego
  // "tarde" o el usuario hizo un flick fisicamente imposible: ignoramos
  // el exceso para que el seek no salte cientos de segundos de golpe.
  const MAX_DELTA_PER_MOVE_RAD = 2 * Math.PI

  const angleFromCenter = (clientX: number, clientY: number, cx: number, cy: number): number => {
    return Math.atan2(clientY - cy, clientX - cx)
  }

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scratchEnabled || !platterRef.current) return
    // Si quedo un drag previo sin cerrar (pointerup perdido), liberalo limpiamente.
    if (dragStateRef.current) {
      if (dragStateRef.current.moved) stopScratch()
      dragStateRef.current = null
    }
    const rect = platterRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const angle = angleFromCenter(e.clientX, e.clientY, cx, cy)
    dragStateRef.current = {
      pointerId: e.pointerId,
      centerX: cx,
      centerY: cy,
      lastAngle: angle,
      lastTime: performance.now(),
      rotation: 0,
      moved: false,
      lastDeltaSign: 0
    }
    try { platterRef.current.setPointerCapture(e.pointerId) } catch { /* no-op */ }
    // Diferimos onScratchStart/startScratch hasta el primer movimiento real.
    // Asi un tap accidental no dispara seek ni interrumpe la reproduccion.
    e.preventDefault()
  }, [scratchEnabled])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStateRef.current
    if (!ds || ds.pointerId !== e.pointerId) return
    const angle = angleFromCenter(e.clientX, e.clientY, ds.centerX, ds.centerY)
    const rawDelta = angle - ds.lastAngle
    let delta = rawDelta
    // Normaliza a [-PI, PI] para no saltar al cruzar la discontinuidad.
    if (delta > Math.PI) delta -= 2 * Math.PI
    else if (delta < -Math.PI) delta += 2 * Math.PI

    const now = performance.now()
    const dt = Math.max(1, now - ds.lastTime)

    // Anti-wrap en spins rapidos: si la normalizacion invirtio el signo
    // respecto del giro previo y los eventos vienen seguidos (dt < 80ms),
    // el usuario probablemente cubrio mas de PI rad entre samples. Tomamos
    // el "camino largo" en la direccion del ultimo signo conocido para
    // que el seek siga avanzando en lugar de saltar para atras y silenciar.
    if (
      ds.lastDeltaSign !== 0 &&
      Math.sign(delta) !== ds.lastDeltaSign &&
      dt < 80
    ) {
      delta += ds.lastDeltaSign * 2 * Math.PI
    }

    // Cap del delta absoluto para que un evento aislado no genere seeks
    // gigantes (ej. el OS dropea pointermoves y reaparece muy rotado).
    if (delta > MAX_DELTA_PER_MOVE_RAD) delta = MAX_DELTA_PER_MOVE_RAD
    else if (delta < -MAX_DELTA_PER_MOVE_RAD) delta = -MAX_DELTA_PER_MOVE_RAD

    // Si todavia no se considera "moved", esperamos a superar el umbral.
    if (!ds.moved) {
      ds.rotation += (delta * 180) / Math.PI
      ds.lastAngle = angle
      ds.lastTime = now
      if (delta !== 0) ds.lastDeltaSign = delta > 0 ? 1 : -1
      if (Math.abs(ds.rotation) < (SCRATCH_MOVE_THRESHOLD_RAD * 180) / Math.PI) {
        return
      }
      // Cruzamos el umbral: ahora si arrancamos el scratch "oficialmente".
      ds.moved = true
      setDragRotation(ds.rotation)
      onScratchStart?.()
      startScratch()
      return
    }

    const velocity = delta / dt // rad/ms

    // Convierte la rotacion en delta de segundos de audio.
    const deltaSec = (delta / (2 * Math.PI)) * SECONDS_PER_REVOLUTION

    if (onScratch && deltaSec !== 0) onScratch(deltaSec)
    updateScratch(velocity)

    ds.lastAngle = angle
    ds.lastTime = now
    if (delta !== 0) ds.lastDeltaSign = delta > 0 ? 1 : -1
    ds.rotation += (delta * 180) / Math.PI
    setDragRotation(ds.rotation)
  }, [onScratch, onScratchStart])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStateRef.current
    if (!ds || ds.pointerId !== e.pointerId) return
    try { platterRef.current?.releasePointerCapture(e.pointerId) } catch { /* no-op */ }
    const wasScratching = ds.moved
    dragStateRef.current = null
    setDragRotation(null)
    if (wasScratching) {
      stopScratch()
      onScratchEnd?.()
    }
  }, [onScratchEnd])

  // Cleanup en unmount: corta cualquier scratch en curso.
  useEffect(() => {
    return () => {
      if (dragStateRef.current) {
        const wasScratching = dragStateRef.current.moved
        dragStateRef.current = null
        if (wasScratching) stopScratch()
      }
    }
  }, [])

  const isDragging = dragRotation !== null
  const platterStyle = isDragging
    ? { transform: `rotate(${dragRotation}deg)`, animation: 'none' as const }
    : undefined

  return (
    <div className={styles.deck} data-testid={`deck-${id}`}>
      <div className={styles.deckHeader}>
        <span className={styles.deckLabel}>
          DECK {id}{id === 'A' ? ' · MAIN' : ' · AUX'}
          {live && <span className={styles.liveBadge}>● LIVE</span>}
        </span>
        {state.cued && <span className={styles.cueBadge}>🎧 CUE</span>}
      </div>

      {/* Turntable: platter giratorio. Anillo exterior = progreso de la pista.
          Si onScratch esta provisto, se puede arrastrar para rebobinar/avanzar. */}
      <div
        ref={platterRef}
        className={`${styles.platterWrap} ${state.playing && !isDragging ? styles.platterSpinning : ''} ${scratchEnabled ? styles.platterScratchable : ''} ${isDragging ? styles.platterDragging : ''}`}
        data-testid={`platter-${id}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <svg className={styles.platterRing} viewBox="0 0 180 180" aria-hidden="true">
          <circle cx="90" cy="90" r="78" className={styles.platterRingBg} />
          <circle
            cx="90"
            cy="90"
            r="78"
            className={styles.platterRingFg}
            strokeDasharray={ringDash}
            strokeDashoffset={ringOffset}
          />
        </svg>
        <div className={styles.platter} style={platterStyle}>
          <div className={styles.platterGroove} />
          <div className={styles.platterMarker} />
          <div className={styles.platterCenter}>
            <span className={styles.platterDeckId}>{id}</span>
          </div>
        </div>
      </div>

      <div className={styles.deckBody}>
        {live ? (
          <div className={styles.liveSourceHint} title="Este deck refleja el tema de la playlist en vivo">
            🎵 Playlist en vivo
          </div>
        ) : (
          <select
            className={styles.assetSelect}
            value={state.asset?.id ?? ''}
            onChange={(e) => {
              const asset = assets.find((a) => a.id === e.target.value)
              if (asset) onLoad(asset)
            }}
          >
            <option value="">— Cargar tema —</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
        <div className={styles.trackInfo}>
          <div className={styles.trackName}>{state.asset?.name ?? '—'}</div>
          <div className={styles.trackTime}>
            {formatTime(state.positionSec)} / {formatTime(state.durationSec)}
          </div>
        </div>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.btn}
            onClick={onPlayPause}
            disabled={live || !state.asset}
            aria-label={state.playing ? 'Pause' : 'Play'}
            title={live ? 'Controlado por la playlist' : undefined}
          >
            {state.playing ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${state.cued ? styles.cueActive : ''}`}
            onClick={onToggleCue}
            disabled={live || !state.asset || !monitorAvailable}
            title={
              live
                ? 'CUE no disponible para el deck en vivo'
                : monitorAvailable
                  ? 'Cue al Monitor'
                  : 'Configurá un Monitor en Integraciones para usar CUE'
            }
          >
            CUE
          </button>
        </div>
        <div className={styles.volume}>
          <label>Vol</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            aria-label={`Volumen deck ${id}`}
            disabled={live}
            title={live ? 'Volumen controlado por la playlist' : undefined}
          />
        </div>
      </div>
    </div>
  )
}

