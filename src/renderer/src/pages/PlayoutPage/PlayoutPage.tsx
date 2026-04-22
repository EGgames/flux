import { useCallback, useMemo, useState } from 'react'
import type { Profile } from '../../types/ipc.types'
import { usePlaylists } from '../../hooks/usePlaylists'
import { usePrograms } from '../../hooks/usePrograms'
import PanelWorkspace from '../../components/PanelWorkspace/PanelWorkspace'
import { useWorkspaceLayout } from '../../hooks/useWorkspaceLayout'
import styles from './PlayoutPage.module.css'

interface Props {
  activeProfile: Profile | null
  playout: {
    status: import('../../types/ipc.types').PlayoutStatus
    error: string | null
    start: (profileId: string, playlistId?: string) => Promise<void>
    stop: () => Promise<void>
    pause: () => void
    resume: () => void
    next: () => void
    adBreakTimer: {
      name: string | null
      elapsedLabel: string
      remainingLabel: string
    }
    nextAd: {
      countdownLabel: string
      atLabel: string
    }
    equalizer: {
      enabled: boolean
      low: number
      mid: number
      high: number
    }
    setEqualizerBand: (band: 'low' | 'mid' | 'high', value: number) => void
    toggleEqualizer: (enabled: boolean) => void
    resetEqualizer: () => void
  }
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export default function PlayoutPage({ activeProfile, playout }: Props) {
  const { playlists } = usePlaylists(activeProfile?.id ?? null)
  const { programs } = usePrograms(activeProfile?.id ?? null)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('')
  const [layoutProgramId, setLayoutProgramId] = useState<string>('')
  const { layout, saveLayout, workspaceHeight, saveWorkspaceHeight } = useWorkspaceLayout(activeProfile, 'playout-workspace', layoutProgramId || '__default')
  const { status, error, start, stop } = playout

  const isActive = status.state !== 'stopped'

  const handleStart = useCallback(() => {
    if (!activeProfile) return
    start(activeProfile.id, selectedPlaylistId || undefined)
  }, [activeProfile, selectedPlaylistId, start])

  const panels = useMemo(() => [
    {
      id: 'transport',
      title: 'Transporte',
      minW: 360,
      minH: 180,
      defaultRect: { x: 12, y: 12, w: 520, h: 190 },
      content: (
        <div className={styles.transportPanel}>
          <div className={styles.transportRow}>
            <select
              className={`${styles.select}`}
              value={selectedPlaylistId}
              onChange={(e) => setSelectedPlaylistId(e.target.value)}
              disabled={isActive}
            >
              <option value="">— Programa activo —</option>
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.name}</option>
              ))}
            </select>

            {!isActive ? (
              <button className={styles.btnPrimary} onClick={handleStart} disabled={!activeProfile}>
                ▶ Iniciar
              </button>
            ) : (
              <button className={styles.btnSecondary} onClick={stop}>
                ⏹ Detener
              </button>
            )}
          </div>
          <div className={styles.stats}>
            <div><span className={styles.label}>Estado:</span> {status.state}</div>
            <div><span className={styles.label}>Cola:</span> {status.queueLength}</div>
            <div><span className={styles.label}>Canciones desde tanda:</span> {status.songsSinceLastAd}</div>
          </div>
        </div>
      )
    },
    {
      id: 'nowPlaying',
      title: 'En reproducción',
      minW: 320,
      minH: 190,
      defaultRect: { x: 544, y: 12, w: 360, h: 190 },
      content: status.track ? (
        <div>
          <div className={styles.trackName}>{status.track.name}</div>
          <div className={styles.trackMeta}>{formatDuration(status.track.durationMs)}</div>
        </div>
      ) : (
        <div className={styles.empty}>Sin reproducción activa</div>
      )
    },
    {
      id: 'queue',
      title: `Cola (${status.queueIndex + (isActive ? 1 : 0)} / ${status.queueLength})`,
      minW: 420,
      minH: 240,
      defaultRect: { x: 12, y: 214, w: 892, h: 360 },
      content: status.queueLength === 0 ? (
        <div className={styles.empty}>Inicia el playout para ver la cola</div>
      ) : (
        <div className={styles.queue}>
          {Array.from({ length: status.queueLength }).map((_, i) => (
            <div
              key={i}
              className={`${styles.queueItem}${i === status.queueIndex ? ` ${styles.current}` : ''}`}
            >
              <span className={styles.queueIndex}>{i + 1}</span>
              <span className={styles.queueName}>Pista {i + 1}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'adMonitor',
      title: 'Tandas',
      minW: 300,
      minH: 210,
      defaultRect: { x: 916, y: 324, w: 320, h: 250 },
      content: (
        <div className={styles.adMonitorPanel}>
          <div className={styles.adStatBlock}>
            <div className={styles.adStatTitle}>Tanda en curso</div>
            <div className={styles.adStatValue}>{status.state === 'ad_break' ? (playout.adBreakTimer.name ?? 'Tanda publicitaria') : 'Sin tanda activa'}</div>
            <div className={styles.adStatMeta}>Cronómetro: {playout.adBreakTimer.elapsedLabel}</div>
            <div className={styles.adStatMeta}>Restante estimado: {playout.adBreakTimer.remainingLabel}</div>
          </div>

          <div className={styles.adStatBlock}>
            <div className={styles.adStatTitle}>Próxima tanda</div>
            <div className={styles.adStatValue}>{playout.nextAd.countdownLabel}</div>
            <div className={styles.adStatMeta}>{playout.nextAd.atLabel}</div>
          </div>
        </div>
      )
    },
    {
      id: 'equalizer',
      title: 'Ecualizador',
      minW: 320,
      minH: 230,
      defaultRect: { x: 916, y: 12, w: 320, h: 300 },
      content: (
        <div className={styles.equalizerPanel}>
          <label className={styles.eqToggle}>
            <input
              type="checkbox"
              checked={playout.equalizer.enabled}
              onChange={(event) => playout.toggleEqualizer(event.target.checked)}
            />
            Ecualizador activo
          </label>

          <div className={styles.eqBandRow}>
            <span className={styles.eqBandLabel}>Bajos</span>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={playout.equalizer.low}
              onChange={(event) => playout.setEqualizerBand('low', Number(event.target.value))}
            />
            <span className={styles.eqBandValue}>{playout.equalizer.low} dB</span>
          </div>

          <div className={styles.eqBandRow}>
            <span className={styles.eqBandLabel}>Medios</span>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={playout.equalizer.mid}
              onChange={(event) => playout.setEqualizerBand('mid', Number(event.target.value))}
            />
            <span className={styles.eqBandValue}>{playout.equalizer.mid} dB</span>
          </div>

          <div className={styles.eqBandRow}>
            <span className={styles.eqBandLabel}>Agudos</span>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={playout.equalizer.high}
              onChange={(event) => playout.setEqualizerBand('high', Number(event.target.value))}
            />
            <span className={styles.eqBandValue}>{playout.equalizer.high} dB</span>
          </div>

          <button className={styles.btnSecondary} onClick={playout.resetEqualizer}>Reset EQ</button>
        </div>
      )
    }
  ], [
    activeProfile,
    handleStart,
    isActive,
    playlists,
    selectedPlaylistId,
    status.queueIndex,
    status.queueLength,
    status.songsSinceLastAd,
    status.state,
    status.track,
    playout.adBreakTimer.elapsedLabel,
    playout.adBreakTimer.name,
    playout.adBreakTimer.remainingLabel,
    playout.equalizer.enabled,
    playout.equalizer.low,
    playout.equalizer.mid,
    playout.equalizer.high,
    playout.nextAd.atLabel,
    playout.nextAd.countdownLabel,
    playout.resetEqualizer,
    playout.setEqualizerBand,
    playout.toggleEqualizer,
    stop
  ])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Playout</h1>
        <div className={styles.programLayoutControl}>
          <span className={styles.programLabel}>Layout de programa:</span>
          <select
            className={styles.select}
            value={layoutProgramId}
            onChange={(event) => setLayoutProgramId(event.target.value)}
          >
            <option value="">General del perfil</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>{program.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-active)', fontSize: 13 }}>{error}</div>}
      <PanelWorkspace
        panels={panels}
        savedLayout={layout}
        onLayoutChange={saveLayout}
        workspaceHeight={workspaceHeight}
        onWorkspaceHeightChange={saveWorkspaceHeight}
      />
    </div>
  )
}
