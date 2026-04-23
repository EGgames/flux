import { useState, useRef, useEffect } from 'react'
import styles from './MenuBar.module.css'

interface MenuBarProps {
  appName?: string
}

interface MenuItem {
  label: string
  action?: () => void
  separator?: boolean
}

interface Menu {
  label: string
  items: MenuItem[]
}

export default function MenuBar({ appName = 'FLUX' }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showAbout, setShowAbout] = useState(false)
  const barRef = useRef<HTMLDivElement | null>(null)

  const menus: Menu[] = [
    {
      label: 'Archivo',
      items: [
        { label: 'Nuevo perfil', action: () => setOpenMenu(null) },
        { separator: true, label: '' },
        { label: 'Salir', action: () => window.electronAPI.windowControls.close() }
      ]
    },
    {
      label: 'Ayuda',
      items: [
        { label: 'Acerca de FLUX', action: () => { setOpenMenu(null); setShowAbout(true) } }
      ]
    }
  ]

  // Close on click outside
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    if (openMenu) document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [openMenu])

  return (
    <>
    {showAbout && (
      <div className={styles.modalOverlay} onClick={() => setShowAbout(false)}>
        <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalLogo}>FLUX</div>
          <div className={styles.modalVersion}>v0.1.0</div>
          <p className={styles.modalDesc}>Software de emisión automatizada de radio.</p>
          <div className={styles.modalMeta}>
            <span>Electron + React + Prisma</span>
          </div>
          <button className={styles.modalClose} onClick={() => setShowAbout(false)}>Cerrar</button>
        </div>
      </div>
    )}
    <div className={styles.menuBar} ref={barRef}>
      <span className={styles.appName}>{appName}</span>
      {menus.map((menu) => (
        <div key={menu.label} className={styles.menuRoot}>
          <button
            className={`${styles.menuBtn}${openMenu === menu.label ? ` ${styles.active}` : ''}`}
            onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <div className={styles.dropdown}>
              {menu.items.map((item, i) =>
                item.separator ? (
                  <hr key={i} className={styles.separator} />
                ) : (
                  <button key={i} className={styles.dropItem} onClick={item.action}>
                    {item.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
    </>
  )
}
