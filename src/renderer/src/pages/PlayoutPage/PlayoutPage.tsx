import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AudioEffectsConfig, Profile } from '../../types/ipc.types'
import type { PlayoutLogEntry, EqualizerPreset } from '../../hooks/usePlayout'
import MixerDJ from '../../components/MixerDJ/MixerDJ'
import VUMeter from '../../components/VUMeter/VUMeter'
import { usePlaylists } from '../../hooks/usePlaylists'
import { usePrograms } from '../../hooks/usePrograms'
import { useSoundboard } from '../../hooks/useSoundboard'
import PanelWorkspace from '../../components/PanelWorkspace/PanelWorkspace'
import SoundboardGrid from '../../components/SoundboardGrid/SoundboardGrid'
import ProgramsPage from '../ProgramsPage/ProgramsPage'
import IntegrationsPage from '../IntegrationsPage/IntegrationsPage'
import ProfilesPage from '../ProfilesPage/ProfilesPage'
import { useWorkspaceLayout } from '../../hooks/useWorkspaceLayout'
import styles from './PlayoutPage.module.css'

interface Props {
  activeProfile: Profile | null
  profiles: {
    profiles: Profile[]
    activeProfile: Profile | null
    create: (name: string) => Promise<Profile>
    select: (id: string) => Promise<Profile>
    remove: (id: string) => Promise<void>
    update: (id: string, data: { name?: string; preferences?: string }) => Promise<Profile>
  }
  playout: {
    status: import('../../types/ipc.types').PlayoutStatus
    queue: Array<{ id: string; name: string; durationMs: number | null }>
    error: string | null
    start: (profileId: string, playlistId?: string) => Promise<void>
    stop: () => Promise<void>
    pause: () => void
    resume: () => void
    prev: () => void
    next: () => void
    jumpTo: (index: number) => void
    seek: (sec: number) => void
    changePlaylist: (profileId: string, playlistId: string | null) => Promise<void>
    currentSec: number
    durationSec: number
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
      gains: number[]
      presetId: string
    }
    equalizerFrequencies: ReadonlyArray<number>
    equalizerPresets: EqualizerPreset[]
    setEqualizerBand: (bandIndex: number, value: number) => void
    toggleEqualizer: (enabled: boolean) => void
    resetEqualizer: () => void
    applyEqualizerPreset: (presetId: string) => void
    saveEqualizerPreset: (name: string) => { ok: boolean; error?: string; id?: string }
    deleteEqualizerPreset: (presetId: string) => { ok: boolean; error?: string }
    pendingAdBlock: { id: string; name: string } | null
    logs: PlayoutLogEntry[]
    clearLogs: () => void
    audioEffects?: AudioEffectsConfig | null
    updateAudioEffects?: (payload: { crossfadeEnabled?: boolean; crossfadeMs?: number; crossfadeCurve?: 'equal-power' | 'linear' }) => Promise<AudioEffectsConfig | null>
    vuLevels?: { l: number; r: number }
  }
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PlayoutPage({ activeProfile, profiles, playout }: Props) {
  const { playlists } = usePlaylists(activeProfile?.id ?? null)
  const { programs } = usePrograms(activeProfile?.id ?? null)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('')
  const [layoutProgramId, setLayoutProgramId] = useState<string>('')
  const { layout, saveLayout, workspaceHeight, saveWorkspaceHeight } = useWorkspaceLayout(activeProfile, 'playout-workspace', layoutProgramId || '__default')
  const { status, error, start, stop, prev, next, jumpTo, stopAd } = playout

  const handleChangePlaylist = useCallback(() => {
    if (!activeProfile) return
    const playlistId = selectedPlaylistId || null
    playout.changePlaylist(activeProfile.id, playlistId)
  }, [activeProfile, selectedPlaylistId, playout])

  const { buttons: sbButtons, assign: sbAssign, trigger: sbTrigger, stopAll: sbStop, pauseAll: sbPause, resumeAll: sbResume, isPaused: sbPaused, gridResetKey: sbResetKey } = useSoundboard(activeProfile?.id ?? null)
  const [sbAssignSlot, setSbAssignSlot] = useState<number | null>(null)

  // Lista general: se lee de profile.preferences y se guarda allí
  const [generalPlaylistId, setGeneralPlaylistId] = useState<string>('')
  const prevProfileIdRef = useRef<string | null>(null)

  // Cuando cambia el perfil activo, sincronizar generalPlaylistId desde preferences
  useEffect(() => {
    if (activeProfile?.id === prevProfileIdRef.current) return
    prevProfileIdRef.current = activeProfile?.id ?? null
    try {
      const prefs = JSON.parse(activeProfile?.preferences ?? '{}') as { generalPlaylistId?: string }
      setGeneralPlaylistId(prefs.generalPlaylistId ?? '')
    } catch {
      setGeneralPlaylistId('')
    }
  }, [activeProfile])

  const saveGeneralPlaylist = useCallback(async (playlistId: string) => {
    if (!activeProfile) return
    setGeneralPlaylistId(playlistId)
    try {
      const current = JSON.parse(activeProfile.preferences ?? '{}') as Record<string, unknown>
      const updated = { ...current, generalPlaylistId: playlistId || null }
      await profiles.update(activeProfile.id, { preferences: JSON.stringify(updated) })
    } catch {
      // preferences update failure is non-critical
    }
  }, [activeProfile, profiles])
  const handleSbAssign = useCallback(async (slotIndex: number) => {
    setSbAssignSlot(slotIndex)
    const paths = await window.electronAPI.audioAssets.pickFiles()
    if (!paths.length) { setSbAssignSlot(null); return }
    const [asset] = await window.electronAPI.audioAssets.importBatch(paths)
    await sbAssign(slotIndex, { audioAssetId: asset.id, label: asset.name })
    setSbAssignSlot(null)
  }, [sbAssign])

  const [selectedQueueIdx, setSelectedQueueIdx] = useState<number | null>(null)

  const isActive = status.state !== 'stopped'

  const handleStart = useCallback(() => {
    if (!activeProfile) return
    // Si hay una playlist manual seleccionada úsala, si no usa la lista general del perfil
    const playlistToUse = selectedPlaylistId || generalPlaylistId || undefined
    start(activeProfile.id, playlistToUse)
  }, [activeProfile, selectedPlaylistId, generalPlaylistId, start])

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
              <>
                {selectedPlaylistId && (
                  <button
                    className={styles.btnPrimary}
                    onClick={handleChangePlaylist}
                    title="Cambiar a esta lista con fade"
                  >
                    ↪ Cambiar
                  </button>
                )}
                <button className={styles.btnSecondary} onClick={stop}>
                  ⏹ Detener
                </button>
                {status.state === 'ad_break' && (
                  <button
                    className={styles.btnDanger}
                    onClick={() => { void stopAd() }}
                    title="Detener tanda en curso"
                  >
                    ⏹ Detener tanda
                  </button>
                )}
                <button
                  className={styles.btnSecondary}
                  onClick={prev}
                  disabled={status.queueIndex <= 0}
                  title="Anterior"
                >
                  ⏮
                </button>
                <button
                  className={styles.btnSecondary}
                  onClick={next}
                  disabled={status.queueIndex >= status.queueLength - 1}
                  title="Siguiente"
                >
                  ⏭
                </button>
              </>
            )}
          </div>
          <div className={styles.stats}>
            <div><span className={styles.label}>Estado:</span> {status.state}</div>
            <div><span className={styles.label}>Cola:</span> {status.queueLength}</div>
            <div><span className={styles.label}>Canciones desde tanda:</span> {status.songsSinceLastAd}</div>
          </div>
          <div className={styles.generalPlaylistRow}>
            <span className={styles.label}>Lista general (sin programa):</span>
            <select
              className={styles.select}
              value={generalPlaylistId}
              onChange={(e) => saveGeneralPlaylist(e.target.value)}
            >
              <option value="">— Ninguna —</option>
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.name}</option>
              ))}
            </select>
          </div>
          {programs.length === 0 && !generalPlaylistId && (
            <div className={styles.noProgramsNotice}>
              <span className={styles.noProgramsIcon}>ℹ</span>
              <span>No hay programas en la grilla. Seleccioná una <strong>lista general</strong> arriba para mantener el aire.</span>
            </div>
          )}
          {programs.length === 0 && generalPlaylistId && (
            <div className={`${styles.noProgramsNotice} ${styles.noProgramsNoticeOk}`}>
              <span className={styles.noProgramsIcon}>✓</span>
              <span>Sin programas activos — se usará la <strong>lista general</strong>.</span>
            </div>
          )}
          {playout.pendingAdBlock && (
            <div className={`${styles.noProgramsNotice} ${styles.noProgramsNoticeWarn}`}>
              <span className={styles.noProgramsIcon}>🔔</span>
              <span>Tanda <strong>{playout.pendingAdBlock.name}</strong> saldrá al terminar el tema actual.</span>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'nowPlaying',
      title: 'En reproducción',
      minW: 320,
      minH: 190,
      defaultRect: { x: 544, y: 12, w: 360, h: 190 },
      content: status.track ? (() => {
        let tags: string[] = []
        try { tags = JSON.parse(status.track.tags) } catch { tags = [] }
        const fileName = status.track.sourceType === 'local'
          ? status.track.sourcePath.split(/[\\/]/).pop() ?? status.track.sourcePath
          : status.track.sourcePath
        return (
          <div>
            <div className={styles.trackName}>{status.track.name}</div>
            <div className={styles.trackPath} title={status.track.sourcePath}>{fileName}</div>
            {tags.length > 0 && (
              <div className={styles.trackTags}>
                {tags.map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}
              </div>
            )}
            <div className={styles.progressRow}>
              <input
                type="range"
                className={styles.progressBar}
                min={0}
                max={playout.durationSec || 1}
                step={1}
                value={playout.currentSec}
                onChange={(e) => playout.seek(Number(e.target.value))}
              />
              <div className={styles.progressLabels}>
                <span>{formatSec(playout.currentSec)}</span>
                <span>{playout.durationSec > 0 ? formatSec(playout.durationSec) : formatDuration(status.track.durationMs)}</span>
              </div>
            </div>
          </div>
        )
      })() : (
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
          {(playout.queue.length > 0 ? playout.queue : Array.from({ length: status.queueLength })).map((item, i) => (
            <div
              key={i}
              className={[
                styles.queueItem,
                i === status.queueIndex ? styles.current : '',
                i === selectedQueueIdx && i !== status.queueIndex ? styles.selected : ''
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedQueueIdx(i)}
              onDoubleClick={() => { jumpTo(i); setSelectedQueueIdx(null) }}
              title="Clic para seleccionar · Doble clic para reproducir"
            >
              <span className={styles.queueIndex}>
                {i === status.queueIndex ? '▶' : `${i + 1}`}
              </span>
              <span className={styles.queueName}>
                {(item as { name?: string })?.name ?? `Pista ${i + 1}`}
              </span>
              {(item as { durationMs?: number | null })?.durationMs != null && (
                <span className={styles.queueDur}>{formatDuration((item as { durationMs: number }).durationMs)}</span>
              )}
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
      minW: 480,
      minH: 280,
      defaultRect: { x: 916, y: 12, w: 540, h: 340 },
      content: (
        <div className={styles.equalizerPanel}>
          <div className={styles.eqHeader}>
            <label className={styles.eqToggle}>
              <input
                type="checkbox"
                checked={playout.equalizer.enabled}
                onChange={(event) => playout.toggleEqualizer(event.target.checked)}
              />
              Activo
            </label>
            <select
              className={styles.eqPresetSelect}
              value={playout.equalizer.presetId}
              onChange={(event) => playout.applyEqualizerPreset(event.target.value)}
            >
              {playout.equalizer.presetId === 'custom' && (
                <option value="custom">Custom (sin guardar)</option>
              )}
              <optgroup label="Built-in">
                {playout.equalizerPresets.filter((p) => p.builtIn).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
              {playout.equalizerPresets.some((p) => !p.builtIn) && (
                <optgroup label="Personalizados">
                  {playout.equalizerPresets.filter((p) => !p.builtIn).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              className={styles.btnSecondary}
              onClick={() => {
                const name = window.prompt('Nombre del preset:')
                if (!name) return
                const result = playout.saveEqualizerPreset(name)
                if (!result.ok) window.alert(result.error ?? 'No se pudo guardar el preset')
              }}
              title="Guardar configuración actual como preset"
            >Guardar…</button>
            {!playout.equalizerPresets.find((p) => p.id === playout.equalizer.presetId)?.builtIn
              && playout.equalizer.presetId !== 'custom' && (
              <button
                className={styles.btnSecondary}
                onClick={() => {
                  if (!window.confirm('¿Eliminar este preset?')) return
                  const result = playout.deleteEqualizerPreset(playout.equalizer.presetId)
                  if (!result.ok) window.alert(result.error ?? 'No se pudo eliminar')
                }}
                title="Eliminar preset personalizado"
              >Eliminar</button>
            )}
            <button className={styles.btnSecondary} onClick={playout.resetEqualizer} title="Volver a 0 dB">Reset</button>
          </div>

          <div className={styles.eqBandsGrid}>
            {playout.equalizerFrequencies.map((freq, idx) => {
              const value = playout.equalizer.gains[idx] ?? 0
              const label = freq >= 1000 ? `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}k` : `${freq}`
              return (
                <div key={freq} className={styles.eqBandColumn}>
                  <span className={styles.eqBandValue}>{value > 0 ? `+${value}` : value}</span>
                  <input
                    className={styles.eqBandSlider}
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={value}
                    onChange={(event) => playout.setEqualizerBand(idx, Number(event.target.value))}
                    aria-label={`Banda ${label} Hz`}
                    /* @ts-expect-error vendor css custom orientation */
                    orient="vertical"
                  />
                  <span className={styles.eqBandFreq}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    },
    {
      id: 'soundboard',
      title: 'Soundboard',
      minW: 480,
      minH: 300,
      defaultRect: { x: 12, y: 590, w: 640, h: 340 },
      content: (
        <div className={styles.soundboardPanelWrap}>
          <div className={styles.soundboardPanelControls}>
            <button className={styles.btnSecondary} onClick={sbStop} title="Detener todo">⏹ Stop</button>
            {sbPaused ? (
              <button className={styles.btnPrimary} onClick={sbResume} title="Reanudar todo">▶ Reanudar</button>
            ) : (
              <button className={styles.btnSecondary} onClick={sbPause} title="Pausar todo">⏸ Pausar</button>
            )}
          </div>
          <SoundboardGrid
            key={sbResetKey}
            buttons={sbButtons}
            onTrigger={sbTrigger}
            onAssign={handleSbAssign}
          />
          {sbAssignSlot !== null && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
              Seleccionando audio para botón {sbAssignSlot}…
            </div>
          )}
        </div>
      )
    },
    {
      id: 'programs',
      title: 'Grilla de Programas',
      minW: 540,
      minH: 320,
      defaultRect: { x: 664, y: 590, w: 580, h: 380 },
      content: <ProgramsPage profileId={activeProfile?.id ?? null} />
    },
    {
      id: 'outputs',
      title: 'Salidas',
      minW: 400,
      minH: 320,
      defaultRect: { x: 12, y: 950, w: 620, h: 420 },
      content: <IntegrationsPage profileId={activeProfile?.id ?? null} />
    },
    {
      id: 'profiles',
      title: 'Perfiles',
      minW: 320,
      minH: 240,
      defaultRect: { x: 644, y: 950, w: 400, h: 300 },
      content: <ProfilesPage profiles={profiles} />
    },
    {
      id: 'logs',
      title: 'Registro de actividad',
      minW: 360,
      minH: 240,
      defaultRect: { x: 1056, y: 950, w: 460, h: 320 },
      content: (
        <div className={styles.logsPanel}>
          <div className={styles.logsToolbar}>
            <span className={styles.logsCount}>{playout.logs.length} eventos</span>
            <button
              className={styles.btnSecondary}
              onClick={playout.clearLogs}
              disabled={playout.logs.length === 0}
            >Limpiar</button>
          </div>
          <div className={styles.logsList} role="log" aria-live="polite">
            {playout.logs.length === 0 && (
              <div className={styles.logsEmpty}>Sin eventos todavía.</div>
            )}
            {playout.logs.slice().reverse().map((entry) => (
              <div key={entry.id} className={`${styles.logsItem} ${styles[`logsItem_${entry.level}`] ?? ''}`}>
                <span className={styles.logsTime}>
                  {new Date(entry.timestamp).toLocaleTimeString('es-AR', { hour12: false })}
                </span>
                <span className={styles.logsMessage}>{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'crossfadeStatus',
      title: 'Crossfade',
      minW: 240,
      minH: 120,
      defaultRect: { x: 1056, y: 1280, w: 320, h: 140 },
      content: (
        <div className={styles.transportPanel}>
          {playout.audioEffects ? (
            <>
              <div className={styles.stats}>
                <div>
                  <span className={styles.label}>Estado:</span>{' '}
                  {playout.audioEffects.crossfadeEnabled ? 'ON' : 'OFF'}
                </div>
                <div>
                  <span className={styles.label}>Duración:</span>{' '}
                  {(playout.audioEffects.crossfadeMs / 1000).toFixed(1)} s
                </div>
                <div>
                  <span className={styles.label}>Curva:</span>{' '}
                  {playout.audioEffects.crossfadeCurve}
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <a href="#/efectos" className={styles.btnSecondary}>Configurar</a>
              </div>
            </>
          ) : (
            <div className={styles.logsEmpty}>
              Sin configuración. <a href="#/efectos">Ir a Efectos</a>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'mixerDJ',
      title: 'Mixer DJ',
      minW: 480,
      minH: 280,
      defaultRect: { x: 12, y: 1280, w: 720, h: 320 },
      content: <MixerDJ profileId={activeProfile?.id ?? null} />
    },
    {
      id: 'vuMeter',
      title: 'Niveles (VU)',
      minW: 160,
      minH: 220,
      defaultRect: { x: 1392, y: 12, w: 220, h: 360 },
      content: <VUMeter left={playout.vuLevels?.l ?? -Infinity} right={playout.vuLevels?.r ?? -Infinity} />
    }
  ], [
    activeProfile,
    handleStart,
    handleChangePlaylist,
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
    playout.equalizer.gains,
    playout.equalizer.presetId,
    playout.equalizerFrequencies,
    playout.equalizerPresets,
    playout.nextAd.atLabel,
    playout.nextAd.countdownLabel,
    playout.resetEqualizer,
    playout.setEqualizerBand,
    playout.toggleEqualizer,
    playout.applyEqualizerPreset,
    playout.saveEqualizerPreset,
    playout.deleteEqualizerPreset,
    playout.currentSec,
    playout.durationSec,
    playout.seek,
    playout.changePlaylist,
    playout.pendingAdBlock,
    selectedQueueIdx,
    stop,
    sbButtons,
    sbTrigger,
    sbAssign,
    sbStop,
    sbPause,
    sbResume,
    sbPaused,
    sbResetKey,
    sbAssignSlot,
    handleSbAssign,
    profiles,
    generalPlaylistId,
    saveGeneralPlaylist,
    playout.logs,
    playout.clearLogs,
    playout.audioEffects,
    playout.vuLevels
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
