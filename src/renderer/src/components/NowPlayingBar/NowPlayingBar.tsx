import type { PlayoutStatus } from '../../types/ipc.types'
import styles from './NowPlayingBar.module.css'

interface Props {
  status: PlayoutStatus
  controls: {
    pause: () => void
    resume: () => void
    prev: () => void
    next: () => void
    stop: () => void
    volume: number
    setVolume: (v: number) => void
  }
}

const STATE_LABELS: Record<PlayoutStatus['state'], string> = {
  stopped: 'Detenido',
  playing: 'En aire',
  paused: 'Pausado',
  ad_break: 'Tanda'
}

export default function NowPlayingBar({ status, controls }: Props) {
  const { state, track, queueIndex, queueLength } = status
  const isPlaying = state === 'playing'
  const isPaused = state === 'paused'
  const isAdBreak = state === 'ad_break'
  const volumePct = Math.round(controls.volume * 100)

  const stateClass =
    isAdBreak
      ? styles.stateAdBreak
      : isPlaying
        ? styles.statePlaying
        : isPaused
          ? styles.statePaused
          : styles.stateStopped

  return (
    <div className={styles.bar}>
      <div className={styles.trackInfo}>
        <div className={styles.trackName}>{track?.name ?? '— Sin reproducción —'}</div>
        <div className={styles.trackMeta}>
          {state !== 'stopped' && `${queueIndex + 1} / ${queueLength}`}
        </div>
      </div>

      <div className={styles.controls}>
        {(isPlaying || isAdBreak) && (
          <button className={styles.btn} onClick={controls.pause} title="Pausar">
            ⏸
          </button>
        )}
        {isPaused && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={controls.resume} title="Reanudar">
            ▶
          </button>
        )}
        <button className={styles.btn} onClick={controls.prev} title="Anterior" disabled={state === 'stopped' || status.queueIndex <= 0}>
          ⏮
        </button>
        <button className={styles.btn} onClick={controls.next} title="Siguiente" disabled={state === 'stopped'}>
          ⏭
        </button>
        <button className={styles.btn} onClick={controls.stop} title="Detener" disabled={state === 'stopped'}>
          ⏹
        </button>
      </div>

      <div className={styles.volumeControl}>
        <span className={styles.volumeIcon} title={`Volumen: ${volumePct}%`}>
          {controls.volume === 0 ? '🔇' : controls.volume < 0.5 ? '🔉' : '🔊'}
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={controls.volume}
          onChange={(e) => controls.setVolume(parseFloat(e.target.value))}
          className={styles.volumeSlider}
          title={`Volumen: ${volumePct}%`}
        />
        <span className={styles.volumeLabel}>{volumePct}%</span>
      </div>

      <span className={`${styles.state} ${stateClass}`}>
        {STATE_LABELS[state]}
      </span>
    </div>
  )
}
