import type { PlayoutStatus } from '../../types/ipc.types'
import styles from './TrackTickerBar.module.css'

interface QueueItem {
  id: string
  name: string
  durationMs: number | null
}

interface Props {
  status: PlayoutStatus
  queue: QueueItem[]
}

/**
 * Barra superior independiente que muestra los temas anterior, actual y siguiente
 * de la cola de reproduccion. Se actualiza en tiempo real con el playout.
 */
export default function TrackTickerBar({ status, queue }: Props) {
  const idx = status.queueIndex
  const len = status.queueLength
  const isStopped = status.state === 'stopped'

  const prev = !isStopped && idx > 0 ? queue[idx - 1] ?? null : null
  const current = !isStopped ? status.track : null
  const next = !isStopped && idx >= 0 && idx + 1 < len ? queue[idx + 1] ?? null : null

  return (
    <div className={styles.bar} data-testid="track-ticker-bar">
      <Slot label="Anterior" icon="⏮" track={prev} />
      <Slot label="En aire" icon="🔴" track={current} highlight />
      <Slot label="Siguiente" icon="⏭" track={next} />
    </div>
  )
}

interface SlotProps {
  label: string
  icon: string
  track: { name: string } | null
  highlight?: boolean
}

function Slot({ label, icon, track, highlight = false }: SlotProps) {
  return (
    <div className={`${styles.slot} ${highlight ? styles.slotCurrent : ''}`}>
      <span className={styles.slotIcon} aria-hidden="true">{icon}</span>
      <div className={styles.slotText}>
        <div className={styles.slotLabel}>{label}</div>
        <div className={styles.slotName} title={track?.name ?? '—'}>
          {track?.name ?? '—'}
        </div>
      </div>
    </div>
  )
}
