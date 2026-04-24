import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const usePlaylists = vi.fn()
const usePrograms = vi.fn()
const useWorkspaceLayout = vi.fn()

vi.mock('@renderer/hooks/usePlaylists', () => ({
  usePlaylists: (...args: unknown[]) => usePlaylists(...args)
}))
vi.mock('@renderer/hooks/usePrograms', () => ({
  usePrograms: (...args: unknown[]) => usePrograms(...args)
}))
vi.mock('@renderer/hooks/useWorkspaceLayout', () => ({
  useWorkspaceLayout: (...args: unknown[]) => useWorkspaceLayout(...args)
}))
vi.mock('@renderer/services/playlistService', () => ({
  playlistService: {
    getWithItems: vi.fn().mockResolvedValue(null),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    reorder: vi.fn()
  }
}))
vi.mock('@renderer/components/PanelWorkspace/PanelWorkspace', () => ({
  default: ({ panels }: { panels: Array<{ id: string; content: React.ReactNode }> }) => (
    <div data-testid="workspace">
      {panels.map((p) => <div key={p.id}>{p.content}</div>)}
    </div>
  )
}))

import PlaylistsPage from '@renderer/pages/PlaylistsPage/PlaylistsPage'
import type { Profile, PlayoutStatus } from '@renderer/types/ipc.types'

const profile: Profile = {
  id: 'p1', name: 'P', isDefault: true,
  preferences: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const status: PlayoutStatus = {
  state: 'stopped',
  profileId: null,
  track: null,
  queueIndex: 0,
  queueLength: 0,
  songsSinceLastAd: 0
}

const playoutProp = {
  status,
  start: vi.fn().mockResolvedValue(undefined),
  jumpTo: vi.fn(),
  stop: vi.fn().mockResolvedValue(undefined)
}

describe('PlaylistsPage', () => {
  beforeEach(() => {
    usePlaylists.mockReturnValue({
      playlists: [{ id: 'pl1', name: 'Lista A' }],
      create: vi.fn(),
      remove: vi.fn(),
      reload: vi.fn()
    })
    usePrograms.mockReturnValue({ programs: [] })
    useWorkspaceLayout.mockReturnValue({
      layout: null,
      saveLayout: vi.fn(),
      workspaceHeight: 600,
      saveWorkspaceHeight: vi.fn()
    })
  })

  it('renders without crashing and shows title', async () => {
    render(<PlaylistsPage activeProfile={profile} playout={playoutProp} />)
    await waitFor(() => expect(screen.getByText('Playlists')).toBeInTheDocument())
  })

  it('renders existing playlist names', async () => {
    render(<PlaylistsPage activeProfile={profile} playout={playoutProp} />)
    await waitFor(() => expect(screen.getByText('Lista A')).toBeInTheDocument())
  })

  it('renders without crashing when activeProfile is null', () => {
    expect(() =>
      render(<PlaylistsPage activeProfile={null} playout={playoutProp} />)
    ).not.toThrow()
  })
})
