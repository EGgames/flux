import { useMemo, useState, useEffect } from 'react'
import type { Playlist, Profile } from '../../types/ipc.types'
import { usePlaylists } from '../../hooks/usePlaylists'
import { usePrograms } from '../../hooks/usePrograms'
import { playlistService } from '../../services/playlistService'
import PanelWorkspace from '../../components/PanelWorkspace/PanelWorkspace'
import { useWorkspaceLayout } from '../../hooks/useWorkspaceLayout'
import styles from './PlaylistsPage.module.css'

interface Props { activeProfile: Profile | null }

const ACCEPTED_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'])

function extractAudioPathsFromDrop(event: React.DragEvent<HTMLDivElement>): string[] {
  const droppedFiles = Array.from(event.dataTransfer.files ?? [])
  const normalized = droppedFiles
    .map((file) => {
      const fileWithPath = file as File & { path?: string }
      return fileWithPath.path || ''
    })
    .filter(Boolean)

  return normalized.filter((path) => {
    const extension = path.split('.').pop()?.toLowerCase() ?? ''
    return ACCEPTED_AUDIO_EXTENSIONS.has(extension)
  })
}

function formatDuration(ms: number | null) {
  if (!ms) return '—'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export default function PlaylistsPage({ activeProfile }: Props) {
  const profileId = activeProfile?.id ?? null
  const { playlists, create, remove, reload } = usePlaylists(profileId)
  const { programs } = usePrograms(profileId)
  const [selected, setSelected] = useState<Playlist | null>(null)
  const [newName, setNewName] = useState('')
  const [layoutProgramId, setLayoutProgramId] = useState<string>('')
  const [dropActive, setDropActive] = useState(false)
  const [dropFeedback, setDropFeedback] = useState<string | null>(null)
  const { layout, saveLayout, workspaceHeight, saveWorkspaceHeight } = useWorkspaceLayout(activeProfile, 'playlists-workspace', layoutProgramId || '__default')

  useEffect(() => { setSelected(null) }, [profileId])

  const handleCreate = async () => {
    if (!newName.trim()) return
    await create(newName.trim())
    setNewName('')
  }

  const handleSelect = async (pl: Playlist) => {
    const detail = await playlistService.getWithItems(pl.id)
    setSelected(detail)
  }

  const handleImport = async () => {
    if (!selected) return
    const paths = await window.electronAPI.audioAssets.pickFiles()
    if (!paths.length) return
    const assets = await window.electronAPI.audioAssets.importBatch(paths)
    const offset = selected.items?.length ?? 0
    for (let i = 0; i < assets.length; i++) {
      await playlistService.addItem(selected.id, assets[i].id, offset + i)
    }
    const updated = await playlistService.getWithItems(selected.id)
    setSelected(updated)
    reload()
  }

  const handleExternalDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDropActive(false)

    if (!selected) {
      setDropFeedback('Primero selecciona una playlist para importar.')
      return
    }

    const paths = extractAudioPathsFromDrop(event)
    if (!paths.length) {
      setDropFeedback('No se detectaron archivos de audio compatibles.')
      return
    }

    const assets = await window.electronAPI.audioAssets.importBatch(paths)
    const offset = selected.items?.length ?? 0
    for (let i = 0; i < assets.length; i++) {
      await playlistService.addItem(selected.id, assets[i].id, offset + i)
    }

    const updated = await playlistService.getWithItems(selected.id)
    setSelected(updated)
    setDropFeedback(`${assets.length} archivo(s) importado(s) desde carpeta externa.`)
    reload()
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!selected) return
    await playlistService.removeItem(itemId)
    const updated = await playlistService.getWithItems(selected.id)
    setSelected(updated)
  }

  const panels = useMemo(() => [
    {
      id: 'playlists',
      title: 'Playlists',
      minW: 320,
      minH: 260,
      defaultRect: { x: 12, y: 12, w: 360, h: 520 },
      content: (
        <>
          <div className={styles.form}>
            <input
              className={styles.input}
              placeholder="Nueva playlist..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button className={styles.btnPrimary} onClick={handleCreate}>+ Crear</button>
          </div>

          <div className={styles.list}>
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className={`${styles.listItem}${selected?.id === pl.id ? ` ${styles.selected}` : ''}`}
                onClick={() => handleSelect(pl)}
              >
                <span className={styles.listItemName}>{pl.name}</span>
                <button
                  className={styles.btnDanger}
                  onClick={(e) => { e.stopPropagation(); remove(pl.id) }}
                >
                  ✕
                </button>
              </div>
            ))}
            {playlists.length === 0 && <div className={styles.empty}>Sin playlists</div>}
          </div>
        </>
      )
    },
    {
      id: 'tracks',
      title: selected ? `Pistas: ${selected.name}` : 'Pistas',
      minW: 460,
      minH: 320,
      defaultRect: { x: 384, y: 12, w: 560, h: 520 },
      content: selected ? (
        <>
          <div className={styles.detailTitle}>
            {selected.name}
            <button className={styles.btnSecondary} onClick={handleImport}>+ Agregar audio</button>
          </div>
          <div
            className={`${styles.dropOverlay}${dropActive ? ` ${styles.dropActive}` : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDropActive(true)
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={handleExternalDrop}
          >
            <div className={styles.trackList}>
              {selected.items?.map((item) => (
                <div key={item.id} className={styles.trackItem}>
                  <span className={styles.trackPos}>{item.position}</span>
                  <span className={styles.trackName}>{item.audioAsset.name}</span>
                  <span className={styles.trackDur}>{formatDuration(item.audioAsset.durationMs)}</span>
                  <button className={styles.btnDanger} onClick={() => handleRemoveItem(item.id)}>✕</button>
                </div>
              ))}
              {!selected.items?.length && <div className={styles.empty}>Sin pistas. Agrega audios o arrastra archivos.</div>}
            </div>
          </div>
        </>
      ) : (
        <div className={styles.empty}>Selecciona una playlist</div>
      )
    },
    {
      id: 'externalDrop',
      title: 'Importación externa',
      minW: 300,
      minH: 220,
      defaultRect: { x: 12, y: 544, w: 932, h: 220 },
      content: (
        <div
          className={`${styles.bigDropZone}${dropActive ? ` ${styles.bigDropActive}` : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDropActive(true)
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={handleExternalDrop}
        >
          <p>Arrastra archivos de audio directamente desde cualquier carpeta del sistema.</p>
          <p className={styles.dropHint}>Formatos: MP3, WAV, FLAC, M4A, AAC, OGG</p>
          {!selected && <p className={styles.dropWarn}>Selecciona primero una playlist.</p>}
          {dropFeedback && <p className={styles.dropInfo}>{dropFeedback}</p>}
        </div>
      )
    }
  ], [
    dropActive,
    dropFeedback,
    handleCreate,
    handleExternalDrop,
    handleImport,
    handleRemoveItem,
    handleSelect,
    newName,
    playlists,
    remove,
    selected
  ])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Playlists</h1>
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
