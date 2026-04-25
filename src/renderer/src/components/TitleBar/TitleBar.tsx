import { useState, useEffect } from 'react'
import styles from './TitleBar.module.css'

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.electronAPI.windowControls.isMaximized().then(setIsMaximized)
  }, [])

  const handleMinimize = () => window.electronAPI.windowControls.minimize()
  const handleMaximize = async () => {
    await window.electronAPI.windowControls.maximize()
    const next = await window.electronAPI.windowControls.isMaximized()
    setIsMaximized(next)
  }
  const handleClose = () => window.electronAPI.windowControls.close()

  return (
    <div className={styles.titleBar}>
      <div className={styles.dragRegion} />
      <div className={styles.windowButtons}>
        <button className={`${styles.winBtn} ${styles.minimize}`} onClick={handleMinimize} title="Minimizar">
          ─
        </button>
        <button className={`${styles.winBtn} ${styles.maximize}`} onClick={handleMaximize} title={isMaximized ? 'Restaurar' : 'Maximizar'}>
          {isMaximized ? '❐' : '□'}
        </button>
        <button className={`${styles.winBtn} ${styles.close}`} onClick={handleClose} title="Cerrar">
          ✕
        </button>
      </div>
    </div>
  )
}
