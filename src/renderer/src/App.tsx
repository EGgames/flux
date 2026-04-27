import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useProfiles } from './hooks/useProfiles'
import { usePlayout } from './hooks/usePlayout'
import { useDeviceChange } from './hooks/useDeviceChange'
import Layout from './components/Layout/Layout'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import StallToast from './components/Toast/StallToast'
import PlayoutPage from './pages/PlayoutPage/PlayoutPage'
import PlaylistsPage from './pages/PlaylistsPage/PlaylistsPage'
import SoundboardPage from './pages/SoundboardPage/SoundboardPage'
import AdBreaksPage from './pages/AdBreaksPage/AdBreaksPage'
import ProgramsPage from './pages/ProgramsPage/ProgramsPage'
import ProfilesPage from './pages/ProfilesPage/ProfilesPage'
import IntegrationsPage from './pages/IntegrationsPage/IntegrationsPage'
import AudioEffectsPage from './pages/AudioEffectsPage/AudioEffectsPage'
import './styles/globals.css'

interface AppLogger {
  log?: (p: { level: 'info' | 'warn' | 'error'; message: string; context?: unknown }) => unknown
}

function reportToMain(level: 'info' | 'warn' | 'error', message: string, context?: unknown): void {
  try {
    const api = (window as unknown as { electronAPI?: { app?: AppLogger } }).electronAPI
    api?.app?.log?.({ level, message, context })
  } catch { /* no-op */ }
}

export default function App() {
  const profiles = useProfiles()
  const playout = usePlayout()
  // Subscripcion al cambio de dispositivos de audio (HU-7).
  useDeviceChange()

  // Handlers globales: reportar errores no atrapados al log persistente.
  useEffect(() => {
    const onError = (event: ErrorEvent): void => {
      reportToMain('error', `[window.error] ${event.message}`, { filename: event.filename, lineno: event.lineno })
    }
    const onRejection = (event: PromiseRejectionEvent): void => {
      reportToMain('error', `[unhandledRejection] ${String(event.reason)}`)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return (
    <ErrorBoundary>
      <Layout
        activeProfile={profiles.activeProfile}
        playoutStatus={playout.status}
        playoutQueue={playout.queue}
        playoutControls={{
          pause: playout.pause,
          resume: playout.resume,
          prev: playout.prev,
          next: playout.next,
          stop: playout.stop,
          volume: playout.volume,
          setVolume: playout.setVolume
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/playout" replace />} />
          <Route
            path="/playout"
            element={
              <PlayoutPage
                activeProfile={profiles.activeProfile}
                profiles={profiles}
                playout={playout}
              />
            }
          />
          <Route
            path="/playlists"
            element={<PlaylistsPage activeProfile={profiles.activeProfile} playout={playout} />}
          />
          <Route
            path="/soundboard"
            element={<SoundboardPage profileId={profiles.activeProfile?.id ?? null} />}
          />
          <Route
            path="/ad-breaks"
            element={<AdBreaksPage profileId={profiles.activeProfile?.id ?? null} />}
          />
          <Route
            path="/programs"
            element={<ProgramsPage profileId={profiles.activeProfile?.id ?? null} />}
          />
          <Route
            path="/profiles"
            element={<ProfilesPage profiles={profiles} />}
          />
          <Route
            path="/integrations"
            element={<IntegrationsPage profileId={profiles.activeProfile?.id ?? null} />}
          />
          <Route
            path="/efectos"
            element={<AudioEffectsPage activeProfile={profiles.activeProfile} />}
          />
        </Routes>
      </Layout>
      <StallToast />
    </ErrorBoundary>
  )
}
