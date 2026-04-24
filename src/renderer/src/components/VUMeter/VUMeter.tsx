import { useMemo } from 'react'
import styles from './VUMeter.module.css'

export interface VUMeterProps {
  /** Nivel pico del canal izquierdo en dBFS (-Infinity = silencio, 0 = full scale). */
  left: number
  /** Nivel pico del canal derecho en dBFS. */
  right: number
  /** Mínimo dB visible (default -60). */
  minDb?: number
  /** Máximo dB visible (default 0). */
  maxDb?: number
  /** Umbral inicio zona amarilla (default -18 dB). */
  yellowDb?: number
  /** Umbral inicio zona roja (default -6 dB). */
  redDb?: number
}

const SCALE_MARKS = [0, -6, -12, -18, -24, -36, -48, -60]

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function dbToPercent(db: number, minDb: number, maxDb: number): number {
  if (!Number.isFinite(db)) return 0
  const range = maxDb - minDb
  if (range <= 0) return 0
  return clamp(((db - minDb) / range) * 100, 0, 100)
}

function formatDb(db: number): string {
  if (!Number.isFinite(db)) return '-∞'
  return `${db.toFixed(1)} dB`
}

interface ChannelBarProps {
  label: string
  db: number
  minDb: number
  maxDb: number
  yellowDb: number
  redDb: number
  testId: string
}

function ChannelBar({ label, db, minDb, maxDb, yellowDb, redDb, testId }: ChannelBarProps) {
  const fillPct = dbToPercent(db, minDb, maxDb)
  const yellowStartPct = dbToPercent(yellowDb, minDb, maxDb)
  const redStartPct = dbToPercent(redDb, minDb, maxDb)
  const isClipping = db >= 0

  return (
    <div className={styles.channel} data-testid={testId}>
      <div className={styles.channelLabel}>{label}</div>
      <div className={styles.bar} role="meter" aria-valuemin={minDb} aria-valuemax={maxDb} aria-valuenow={Number.isFinite(db) ? db : minDb} aria-label={`Nivel ${label}`}>
        <div
          className={styles.fill}
          style={{
            height: `${fillPct}%`,
            background: `linear-gradient(to top,
              #1eaa3a 0%,
              #1eaa3a ${yellowStartPct}%,
              #f5c000 ${yellowStartPct}%,
              #f5c000 ${redStartPct}%,
              #d62828 ${redStartPct}%,
              #d62828 100%)`
          }}
        />
        <div className={styles.tickYellow} style={{ bottom: `${yellowStartPct}%` }} />
        <div className={styles.tickRed} style={{ bottom: `${redStartPct}%` }} />
        {isClipping && <div className={styles.clipIndicator} data-testid={`${testId}-clip`} />}
      </div>
      <div className={styles.dbValue} data-testid={`${testId}-value`}>{formatDb(db)}</div>
    </div>
  )
}

export default function VUMeter({
  left,
  right,
  minDb = -60,
  maxDb = 0,
  yellowDb = -18,
  redDb = -6
}: VUMeterProps): JSX.Element {
  const scale = useMemo(
    () =>
      SCALE_MARKS.filter((m) => m <= maxDb && m >= minDb).map((m) => ({
        db: m,
        bottomPct: dbToPercent(m, minDb, maxDb)
      })),
    [minDb, maxDb]
  )

  return (
    <div className={styles.vu} data-testid="vu-meter">
      <ChannelBar label="L" db={left} minDb={minDb} maxDb={maxDb} yellowDb={yellowDb} redDb={redDb} testId="vu-meter-L" />
      <div className={styles.scale} aria-hidden="true">
        {scale.map((s) => (
          <div key={s.db} className={styles.scaleMark} style={{ bottom: `${s.bottomPct}%` }}>
            {s.db}
          </div>
        ))}
      </div>
      <ChannelBar label="R" db={right} minDb={minDb} maxDb={maxDb} yellowDb={yellowDb} redDb={redDb} testId="vu-meter-R" />
    </div>
  )
}
