import { useEffect, useState } from 'react'
import type { AudioAsset } from '@renderer/types/ipc.types'
import { useMixer } from '@renderer/hooks/useMixer'
import Deck from './Deck'
import styles from './MixerDJ.module.css'

interface Props {
  profileId: string | null
}

export default function MixerDJ({ profileId }: Props) {
  const mixer = useMixer(profileId)
  const [assets, setAssets] = useState<AudioAsset[]>([])

  useEffect(() => {
    let cancelled = false
    const api = window.electronAPI as typeof window.electronAPI | undefined
    if (!api?.audioAssets?.list) return
    void api.audioAssets.list().then((list) => {
      if (!cancelled) setAssets(list)
    }).catch(() => { /* no-op */ })
    return () => { cancelled = true }
  }, [])

  return (
    <div className={styles.mixer} data-testid="mixer-dj">
      <div className={styles.decksRow}>
        <Deck
          id="A"
          state={mixer.decks.A}
          monitorAvailable={mixer.monitorAvailable}
          assets={assets}
          onLoad={(a) => mixer.loadAsset('A', a)}
          onPlayPause={() => mixer.playPause('A')}
          onToggleCue={() => mixer.toggleCue('A')}
          onVolume={(v) => mixer.setDeckVolume('A', v)}
        />
        <Deck
          id="B"
          state={mixer.decks.B}
          monitorAvailable={mixer.monitorAvailable}
          assets={assets}
          onLoad={(a) => mixer.loadAsset('B', a)}
          onPlayPause={() => mixer.playPause('B')}
          onToggleCue={() => mixer.toggleCue('B')}
          onVolume={(v) => mixer.setDeckVolume('B', v)}
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
      </div>
      {!mixer.monitorAvailable && (
        <p className={styles.monitorHint}>
          ℹ️ Configurá un dispositivo de Monitor en <strong>Salidas</strong> para habilitar el CUE.
        </p>
      )}
    </div>
  )
}
