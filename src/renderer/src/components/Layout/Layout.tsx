import type { ReactNode } from 'react'
import type { Profile, PlayoutStatus } from '../../types/ipc.types'
import Sidebar from '../Sidebar/Sidebar'
import NowPlayingBar from '../NowPlayingBar/NowPlayingBar'
import TrackTickerBar from '../TrackTickerBar/TrackTickerBar'
import TitleBar from '../TitleBar/TitleBar'
import MenuBar from '../MenuBar/MenuBar'
import styles from './Layout.module.css'

interface QueueItem {
  id: string
  name: string
  durationMs: number | null
}

interface Props {
  activeProfile: Profile | null
  playoutStatus: PlayoutStatus
  playoutQueue: QueueItem[]
  playoutControls: {
    pause: () => void
    resume: () => void
    prev: () => void
    next: () => void
    stop: () => void
    volume: number
    setVolume: (v: number) => void
  }
  children: ReactNode
}

export default function Layout({ activeProfile, playoutStatus, playoutQueue, playoutControls, children }: Props) {
  const isWindows = navigator.userAgent.includes('Windows')
  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>
        {isWindows && <TitleBar />}
        <MenuBar />
        <TrackTickerBar status={playoutStatus} queue={playoutQueue} />
      </div>
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
