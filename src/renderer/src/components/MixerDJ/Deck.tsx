import type { AudioAsset } from '@renderer/types/ipc.types'
import type { DeckState } from '@renderer/hooks/useMixer'
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
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}

export default function Deck({
  id, state, monitorAvailable, assets, onLoad, onPlayPause, onToggleCue, onVolume
}: DeckProps) {
  return (
    <div className={styles.deck} data-testid={`deck-${id}`}>
      <div className={styles.deckHeader}>
        <span className={styles.deckLabel}>DECK {id}</span>
        {state.cued && <span className={styles.cueBadge}>🎧 CUE</span>}
      </div>
      <div className={styles.deckBody}>
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
            disabled={!state.asset}
            aria-label={state.playing ? 'Pause' : 'Play'}
          >
            {state.playing ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${state.cued ? styles.cueActive : ''}`}
            onClick={onToggleCue}
            disabled={!state.asset || !monitorAvailable}
            title={monitorAvailable ? 'Cue al Monitor' : 'Configurá un Monitor en Integraciones para usar CUE'}
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
          />
        </div>
      </div>
    </div>
  )
}
