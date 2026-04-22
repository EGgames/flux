import { useState } from 'react'
import { useSoundboard } from '../../hooks/useSoundboard'
import SoundboardGrid from '../../components/SoundboardGrid/SoundboardGrid'
import styles from './SoundboardPage.module.css'

interface Props { profileId: string | null }

export default function SoundboardPage({ profileId }: Props) {
  const { buttons, assign, trigger } = useSoundboard(profileId)
  const [assignSlot, setAssignSlot] = useState<number | null>(null)

  const handleAssign = async (slotIndex: number) => {
    setAssignSlot(slotIndex)
    const paths = await window.electronAPI.audioAssets.pickFiles()
    if (!paths.length) { setAssignSlot(null); return }
    const [asset] = await window.electronAPI.audioAssets.importBatch(paths)
    await assign(slotIndex, { audioAssetId: asset.id, label: asset.name })
    setAssignSlot(null)
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Soundboard</h1>
      <SoundboardGrid
        buttons={buttons}
        onTrigger={trigger}
        onAssign={handleAssign}
      />
      {assignSlot !== null && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Seleccionando audio para botón {assignSlot}…
        </div>
      )}
    </div>
  )
}
