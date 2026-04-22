import { Routes, Route, Navigate } from 'react-router-dom'
import { useProfiles } from './hooks/useProfiles'
import { usePlayout } from './hooks/usePlayout'
import Layout from './components/Layout/Layout'
import PlayoutPage from './pages/PlayoutPage/PlayoutPage'
import PlaylistsPage from './pages/PlaylistsPage/PlaylistsPage'
import SoundboardPage from './pages/SoundboardPage/SoundboardPage'
import AdBreaksPage from './pages/AdBreaksPage/AdBreaksPage'
import ProgramsPage from './pages/ProgramsPage/ProgramsPage'
import ProfilesPage from './pages/ProfilesPage/ProfilesPage'
import IntegrationsPage from './pages/IntegrationsPage/IntegrationsPage'
import './styles/globals.css'

export default function App() {
  const profiles = useProfiles()
  const playout = usePlayout()

  return (
    <Layout
      activeProfile={profiles.activeProfile}
      playoutStatus={playout.status}
      playoutControls={{
        pause: playout.pause,
        resume: playout.resume,
        next: playout.next,
        stop: playout.stop
      }}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/playout" replace />} />
        <Route
          path="/playout"
          element={
            <PlayoutPage
              activeProfile={profiles.activeProfile}
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
      </Routes>
    </Layout>
  )
}
