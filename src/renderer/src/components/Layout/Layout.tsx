import type { ReactNode } from 'react'
import type { Profile, PlayoutStatus } from '../../types/ipc.types'
import Sidebar from '../Sidebar/Sidebar'
import NowPlayingBar from '../NowPlayingBar/NowPlayingBar'
import styles from './Layout.module.css'

interface Props {
  activeProfile: Profile | null
  playoutStatus: PlayoutStatus
  playoutControls: {
    pause: () => void
    resume: () => void
    next: () => void
    stop: () => void
  }
  children: ReactNode
}

export default function Layout({ activeProfile, playoutStatus, playoutControls, children }: Props) {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Sidebar activeProfile={activeProfile} />
      </aside>
      <main className={styles.content}>{children}</main>
      <footer className={styles.nowplaying}>
        <NowPlayingBar status={playoutStatus} controls={playoutControls} />
      </footer>
    </div>
  )
}
