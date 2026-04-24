import { useEffect, useState } from 'react'
import type { AudioAsset, AudioEffectsConfig, Profile } from '@renderer/types/ipc.types'
import { audioEffectsService } from '@renderer/services/audioEffectsService'
import MixerDJ from '@renderer/components/MixerDJ/MixerDJ'
import styles from './AudioEffectsPage.module.css'

interface Props {
  activeProfile: Profile | null
}

type TabId = 'global' | 'per-track' | 'mixer'

export default function AudioEffectsPage({ activeProfile }: Props) {
  const [tab, setTab] = useState<TabId>('global')

  if (!activeProfile) {
    return (
      <div className={styles.empty}>
        <h2>Efectos de Audio</h2>
        <p>Seleccioná un Perfil para configurar los efectos.</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>🎚 Efectos de Audio</h1>
        <p className={styles.subtitle}>
          Crossfade automático, fades por tema y mixer DJ — perfil <strong>{activeProfile.name}</strong>
        </p>
      </header>

      <nav className={styles.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'global'}
          className={`${styles.tab} ${tab === 'global' ? styles.tabActive : ''}`}
          onClick={() => setTab('global')}
        >
          Global
        </button>
        <button
          role="tab"
          aria-selected={tab === 'per-track'}
          className={`${styles.tab} ${tab === 'per-track' ? styles.tabActive : ''}`}
          onClick={() => setTab('per-track')}
        >
          Por tema
        </button>
        <button
          role="tab"
          aria-selected={tab === 'mixer'}
          className={`${styles.tab} ${tab === 'mixer' ? styles.tabActive : ''}`}
          onClick={() => setTab('mixer')}
        >
          Mixer DJ
        </button>
      </nav>

      <section className={styles.tabPanel}>
        {tab === 'global' && <GlobalTab profileId={activeProfile.id} />}
        {tab === 'per-track' && <PerTrackTab />}
        {tab === 'mixer' && <MixerDJ profileId={activeProfile.id} />}
      </section>
    </div>
  )
}

// ===== Tab Global =====

function GlobalTab({ profileId }: { profileId: string }) {
  const [cfg, setCfg] = useState<AudioEffectsConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void audioEffectsService.get(profileId)
      .then((c) => { if (!cancelled) setCfg(c) })
      .catch(() => { if (!cancelled) setCfg(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [profileId])

  const save = async (): Promise<void> => {
    if (!cfg) return
    setSaving(true)
    try {
      const updated = await audioEffectsService.update({
        profileId,
        crossfadeEnabled: cfg.crossfadeEnabled,
        crossfadeMs: cfg.crossfadeMs,
        crossfadeCurve: cfg.crossfadeCurve
      })
      setCfg(updated)
      setSavedAt(Date.now())
      window.dispatchEvent(new CustomEvent('flux:audio-effects-changed', { detail: { profileId } }))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className={styles.muted}>Cargando…</p>
  if (!cfg) return <p className={styles.muted}>No se pudo cargar la configuración.</p>

  return (
    <div className={styles.card}>
      <h2>Crossfade global</h2>
      <p className={styles.muted}>
        Solapa automáticamente el final de un tema con el inicio del siguiente.
      </p>

      <label className={styles.row}>
        <input
          type="checkbox"
          checked={cfg.crossfadeEnabled}
          onChange={(e) => setCfg({ ...cfg, crossfadeEnabled: e.target.checked })}
        />
        <span>Habilitar crossfade automático</span>
      </label>

      <label className={styles.field}>
        <span>Duración: <strong>{(cfg.crossfadeMs / 1000).toFixed(1)} s</strong></span>
        <input
          type="range"
          min={500}
          max={15000}
          step={100}
          value={cfg.crossfadeMs}
          onChange={(e) => setCfg({ ...cfg, crossfadeMs: Number(e.target.value) })}
          aria-label="Duración del crossfade"
        />
        <small className={styles.hint}>Rango permitido: 0.5 s a 15 s</small>
      </label>

      <label className={styles.field}>
        <span>Curva</span>
        <select
          value={cfg.crossfadeCurve}
          onChange={(e) =>
            setCfg({ ...cfg, crossfadeCurve: e.target.value as 'equal-power' | 'linear' })
          }
        >
          <option value="equal-power">Equal-Power (recomendado)</option>
          <option value="linear">Lineal</option>
        </select>
        <small className={styles.hint}>
          Equal-Power mantiene el volumen percibido constante durante la transición.
        </small>
      </label>

      <div className={styles.actions}>
        <button className={styles.primary} onClick={() => void save()} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {savedAt && <span className={styles.savedHint}>Guardado ✓</span>}
      </div>
    </div>
  )
}

// ===== Tab Por tema =====

function PerTrackTab() {
  const [assets, setAssets] = useState<AudioAsset[]>([])
  const [filter, setFilter] = useState('')
  const [edits, setEdits] = useState<Record<string, { fadeInMs: string; fadeOutMs: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    void window.electronAPI.audioAssets.list()
      .then(setAssets)
      .catch(() => setAssets([]))
  }, [])

  const filtered = assets.filter((a) =>
    a.name.toLowerCase().includes(filter.toLowerCase())
  )

  const getValue = (asset: AudioAsset, field: 'fadeInMs' | 'fadeOutMs'): string => {
    const local = edits[asset.id]?.[field]
    if (local !== undefined) return local
    const v = asset[field]
    return v !== null && v !== undefined ? String(v) : ''
  }

  const setValue = (assetId: string, field: 'fadeInMs' | 'fadeOutMs', value: string): void => {
    setEdits((prev) => ({
      ...prev,
      [assetId]: {
        fadeInMs: prev[assetId]?.fadeInMs ?? '',
        fadeOutMs: prev[assetId]?.fadeOutMs ?? '',
        [field]: value
      }
    }))
  }

  const saveRow = async (asset: AudioAsset): Promise<void> => {
    setSavingId(asset.id)
    try {
      const inStr = edits[asset.id]?.fadeInMs ?? (asset.fadeInMs?.toString() ?? '')
      const outStr = edits[asset.id]?.fadeOutMs ?? (asset.fadeOutMs?.toString() ?? '')
      const fadeIn = inStr.trim() === '' ? null : Math.round(Number(inStr))
      const fadeOut = outStr.trim() === '' ? null : Math.round(Number(outStr))
      const updated = await audioEffectsService.updateAssetFades(asset.id, fadeIn, fadeOut)
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)))
      setEdits((prev) => {
        const next = { ...prev }
        delete next[asset.id]
        return next
      })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className={styles.card}>
      <h2>Fades por tema</h2>
      <p className={styles.muted}>
        Definí fade in/out propio para cada tema. Si hay crossfade global, se usa el mayor entre los dos.
      </p>
      <input
        type="text"
        placeholder="Buscar tema…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className={styles.search}
        aria-label="Buscar tema"
      />
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Tema</th>
            <th>Fade In (ms)</th>
            <th>Fade Out (ms)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((asset) => (
            <tr key={asset.id}>
              <td>{asset.name}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={15000}
                  step={100}
                  value={getValue(asset, 'fadeInMs')}
                  onChange={(e) => setValue(asset.id, 'fadeInMs', e.target.value)}
                  aria-label={`Fade in ${asset.name}`}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={15000}
                  step={100}
                  value={getValue(asset, 'fadeOutMs')}
                  onChange={(e) => setValue(asset.id, 'fadeOutMs', e.target.value)}
                  aria-label={`Fade out ${asset.name}`}
                />
              </td>
              <td>
                <button
                  className={styles.primary}
                  onClick={() => void saveRow(asset)}
                  disabled={savingId === asset.id || !edits[asset.id]}
                >
                  {savingId === asset.id ? '…' : 'Guardar'}
                </button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className={styles.muted}>Sin resultados</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
