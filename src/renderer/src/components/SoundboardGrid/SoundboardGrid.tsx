import { useState } from 'react'
import type { SoundboardButton } from '../../types/ipc.types'
import styles from './SoundboardGrid.module.css'

interface Props {
  buttons: SoundboardButton[]
  onTrigger: (slotIndex: number) => void
  onAssign?: (slotIndex: number) => void
}

export default function SoundboardGrid({ buttons, onTrigger, onAssign }: Props) {
  const [activeSlots, setActiveSlots] = useState<Set<number>>(new Set())

  const handleClick = (button: SoundboardButton) => {
    if (!button.audioAssetId) {
      onAssign?.(button.slotIndex)
      return
    }
    const slot = button.slotIndex
    if (button.mode === 'toggle') {
      setActiveSlots((prev) => {
        const next = new Set(prev)
        if (next.has(slot)) next.delete(slot)
        else next.add(slot)
        return next
      })
    }
    onTrigger(slot)
  }

  return (
    <div className={styles.grid}>
      {buttons.map((button) => {
        const hasAsset = !!button.audioAssetId
        const isActive = activeSlots.has(button.slotIndex)
        return (
          <button
            key={button.slotIndex}
            className={`${styles.button}${!hasAsset ? ` ${styles.empty}` : ''}${isActive ? ` ${styles.active}` : ''}`}
            style={{ borderColor: hasAsset && !isActive ? button.color : undefined }}
            onClick={() => handleClick(button)}
            title={hasAsset ? (button.label ?? button.audioAsset?.name) : 'Asignar audio'}
            onContextMenu={() => onAssign?.(button.slotIndex)}
          >
            <span className={styles.slot}>{button.slotIndex}</span>
            <span className={styles.label}>
              {hasAsset ? (button.label ?? button.audioAsset?.name ?? '—') : '+'}
            </span>
            {hasAsset && <span className={styles.mode}>{button.mode}</span>}
          </button>
        )
      })}
    </div>
  )
}
