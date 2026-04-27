import { useEffect, useState } from 'react'
import type { AudioAsset } from '@renderer/types/ipc.types'
import { useMixer } from '@renderer/hooks/useMixer'
import Deck from './Deck'
import { setScratchOutput } from './scratchSound'
import styles from './MixerDJ.module.css'

export interface LiveTrack {
  /** Nombre del tema actualmente sonando en la playlist principal. */
  name: string | null
  /** True si el playout esta efectivamente reproduciendo (no pausado/stopped). */
  playing: boolean
  /** Posicion actual del playout en segundos. */
  positionSec: number
  /** Duracion total del tema en segundos. */
  durationSec: number
}

interface Props {
  profileId: string | null
  /**
   * Si se provee, el Deck A se convierte en un visualizador en vivo del tema
   * que esta sonando en la playlist principal (gira automaticamente con la
   * reproduccion). Los controles del Deck A quedan deshabilitados porque
   * la playlist es la fuente de verdad.
   */
  liveTrack?: LiveTrack | null
  /**
   * Callback de scratch sobre el Deck A en modo live. Recibe delta en
   * segundos: positivo = avanzar, negativo = rebobinar. El consumidor debe
   * traducirlo a un seek absoluto sobre el playout.
   */
  onLiveScratch?: (deltaSec: number) => void
  /** Disparado al empezar el gesto de scratch en el Deck A live. */
  onLiveScratchStart?: () => void
  /** Disparado al soltar el gesto de scratch en el Deck A live. */
  onLiveScratchEnd?: () => void
}

export default function MixerDJ({ profileId, liveTrack = null, onLiveScratch, onLiveScratchStart, onLiveScratchEnd }: Props) {
  const mixer = useMixer(profileId)
  const [assets, setAssets] = useState<AudioAsset[]>([])
  // Routing del ruido de scratch: master (todas las salidas) o monitor.
  const [scratchOnMonitor, setScratchOnMonitor] = useState(false)

  useEffect(() => {
    setScratchOutput(
      scratchOnMonitor && mixer.monitorDeviceId ? 'monitor' : 'main',
      mixer.monitorDeviceId
    )
  }, [scratchOnMonitor, mixer.monitorDeviceId])

  useEffect(() => {
    let cancelled = false
    const api = window.electronAPI as typeof window.electronAPI | undefined
    if (!api?.audioAssets?.list) return
    void api.audioAssets.list().then((list) => {
      if (!cancelled) setAssets(list)
    }).catch(() => { /* no-op */ })
    return () => { cancelled = true }
  }, [])

  // Si hay liveTrack, fabricamos un DeckState "virtual" para el Deck A
  // que refleja el tema de la playlist en vivo (read-only).
  const liveDeckAState = liveTrack
    ? {
        asset: liveTrack.name
          ? ({ id: '__live__', name: liveTrack.name } as unknown as AudioAsset)
          : null,
        playing: liveTrack.playing,
        cued: false,
        volume: 1,
        positionSec: liveTrack.positionSec,
        durationSec: liveTrack.durationSec
      }
    : null

  return (
    <div className={styles.mixer} data-testid="mixer-dj">
      <div className={styles.decksRow}>
        {liveDeckAState ? (
          <Deck
            id="A"
            state={liveDeckAState}
            monitorAvailable={mixer.monitorAvailable}
            assets={[]}
            live
            onLoad={() => { /* read-only en modo live */ }}
            onPlayPause={() => { /* controlado por la playlist */ }}
            onToggleCue={() => { /* deshabilitado en modo live */ }}
            onVolume={() => { /* deshabilitado en modo live */ }}
            onScratch={onLiveScratch}
            onScratchStart={onLiveScratchStart}
            onScratchEnd={onLiveScratchEnd}
          />
        ) : (
          <Deck
            id="A"
            state={mixer.decks.A}
            monitorAvailable={mixer.monitorAvailable}
            assets={assets}
            onLoad={(a) => mixer.loadAsset('A', a)}
            onPlayPause={() => mixer.playPause('A')}
            onToggleCue={() => mixer.toggleCue('A')}
            onVolume={(v) => mixer.setDeckVolume('A', v)}
            onScratch={(delta) => mixer.scratchDeck('A', delta)}
            onScratchEnd={() => mixer.flushScratch('A')}
          />
        )}
        <Deck
          id="B"
          state={mixer.decks.B}
          monitorAvailable={mixer.monitorAvailable}
          assets={assets}
          onLoad={(a) => mixer.loadAsset('B', a)}
          onPlayPause={() => mixer.playPause('B')}
          onToggleCue={() => mixer.toggleCue('B')}
          onVolume={(v) => mixer.setDeckVolume('B', v)}
          onScratch={(delta) => mixer.scratchDeck('B', delta)}
          onScratchEnd={() => mixer.flushScratch('B')}
        />
      </div>
      <div className={styles.crossfader}>
        <span className={styles.cfLabelA}>A</span>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={mixer.crossfaderPos}
          onChange={(e) => mixer.setCrossfader(Number(e.target.value))}
          aria-label="Crossfader"
          className={styles.cfSlider}
          data-testid="crossfader"
        />
        <span className={styles.cfLabelB}>B</span>
        <button
          type="button"
          className={`${styles.scratchMonitorBtn} ${scratchOnMonitor ? styles.scratchMonitorActive : ''}`}
          onClick={() => setScratchOnMonitor((v) => !v)}
          disabled={!mixer.monitorAvailable}
          title={
            !mixer.monitorAvailable
              ? 'Configurá un dispositivo Monitor en Salidas'
              : scratchOnMonitor
                ? 'Scratch enviándose al monitor (clic para enviar al master)'
                : 'Scratch enviándose al master (clic para enviar al monitor)'
          }
          data-testid="scratch-monitor-toggle"
        >
          🎧 {scratchOnMonitor ? 'Monitor' : 'Master'}
        </button>
      </div>
      {!mixer.monitorAvailable && (
        <p className={styles.monitorHint}>
          ℹ️ Configurá un dispositivo de Monitor en <strong>Salidas</strong> para habilitar el CUE.
        </p>
      )}
    </div>
  )
}
