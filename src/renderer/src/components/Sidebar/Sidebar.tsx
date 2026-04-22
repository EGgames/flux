import { NavLink } from 'react-router-dom'
import type { Profile } from '../../types/ipc.types'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { to: '/playout', icon: '▶', label: 'Playout' },
  { to: '/playlists', icon: '≡', label: 'Playlists' },
  { to: '/soundboard', icon: '⊞', label: 'Soundboard' },
  { to: '/ad-breaks', icon: '📢', label: 'Tandas' },
  { to: '/programs', icon: '📅', label: 'Programas' },
  { to: '/integrations', icon: '🔌', label: 'Salidas' },
  { to: '/profiles', icon: '👤', label: 'Perfiles' }
]

interface Props {
  activeProfile: Profile | null
}

export default function Sidebar({ activeProfile }: Props) {
  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>F</div>
        <span className={styles.logoText}>FLUX</span>
      </div>
      <div className={styles.nav}>
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.navItem}${isActive ? ` ${styles.active}` : ''}`
            }
          >
            <span className={styles.navIcon}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </div>
      <div className={styles.profile}>
        <div className={styles.profileName}>{activeProfile?.name ?? '—'}</div>
        Perfil activo
      </div>
    </nav>
  )
}
