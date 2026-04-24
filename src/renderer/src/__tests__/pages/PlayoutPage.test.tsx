import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@renderer/hooks/usePlaylists', () => ({
  usePlaylists: () => ({ playlists: [], create: vi.fn(), remove: vi.fn(), reload: vi.fn() })
}))
vi.mock('@renderer/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [], create: vi.fn(), remove: vi.fn() })
}))
vi.mock('@renderer/hooks/useSoundboard', () => ({
  useSoundboard: () => ({
    buttons: [],
    assign: vi.fn(),
    trigger: vi.fn(),
    stopAll: vi.fn(),
    pauseAll: vi.fn(),
    resumeAll: vi.fn(),
    isPaused: false,
    gridResetKey: 0
  })
}))
vi.mock('@renderer/hooks/useWorkspaceLayout', () => ({
  useWorkspaceLayout: () => ({
    layout: null,
    saveLayout: vi.fn(),
    workspaceHeight: 600,
    saveWorkspaceHeight: vi.fn()
  })
}))
vi.mock('@renderer/hooks/useAdBlocks', () => ({
  useAdBlocks: () => ({
    adBlocks: [], adRules: [], createBlock: vi.fn(), removeBlock: vi.fn(), createRule: vi.fn(), removeRule: vi.fn()
  })
}))
vi.mock('@renderer/services/outputService', () => ({
  outputService: { list: vi.fn().mockResolvedValue([]), save: vi.fn(), test: vi.fn(), toggleEnabled: vi.fn() }
}))
vi.mock('@renderer/components/PanelWorkspace/PanelWorkspace', () => ({
  default: ({ panels }: { panels: Array<{ id: string; content: React.ReactNode }> }) => (
    <div data-testid="workspace">{panels.map((p) => <div key={p.id}>{p.content}</div>)}</div>
  )
}))
vi.mock('@renderer/components/SoundboardGrid/SoundboardGrid', () => ({
  default: () => <div data-testid="sb-grid" />
}))

import PlayoutPage from '@renderer/pages/PlayoutPage/PlayoutPage'
import type { Profile, PlayoutStatus } from '@renderer/types/ipc.types'

const profile: Profile = {
  id: 'p1', name: 'P', isDefault: true, preferences: '',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
}

const status: PlayoutStatus = {
  state: 'stopped', profileId: null, track: null,
  queueIndex: 0, queueLength: 0, songsSinceLastAd: 0
}

const playoutProp = {
  status,
  queue: [],
  error: null,
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  resume: vi.fn(),
  prev: vi.fn(),
  next: vi.fn(),
  jumpTo: vi.fn(),
  seek: vi.fn(),
  changePlaylist: vi.fn().mockResolvedValue(undefined),
  currentSec: 0,
  durationSec: 0,
  adBreakTimer: { name: null, elapsedLabel: '0:00', remainingLabel: '0:00' },
  nextAd: { countdownLabel: '—', atLabel: '—' },
  equalizer: { enabled: false, gains: [0, 0, 0, 0, 0, 0, 0, 0], presetId: 'flat' },
  equalizerFrequencies: [60, 170, 310, 600, 1000, 3000, 6000, 12000],
  equalizerPresets: [
    { id: 'flat', name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0], builtIn: true }
  ],
  setEqualizerBand: vi.fn(),
  toggleEqualizer: vi.fn(),
  resetEqualizer: vi.fn(),
  applyEqualizerPreset: vi.fn(),
  saveEqualizerPreset: vi.fn().mockReturnValue({ ok: true, id: 'custom-x' }),
  deleteEqualizerPreset: vi.fn().mockReturnValue({ ok: true }),
  pendingAdBlock: null,
  logs: [],
  clearLogs: vi.fn()
}

const profilesProp = {
  profiles: [profile],
  activeProfile: profile,
  create: vi.fn(),
  select: vi.fn(),
  remove: vi.fn(),
  update: vi.fn()
} as unknown as Parameters<typeof PlayoutPage>[0]['profiles']

describe('PlayoutPage', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { enumerateDevices: vi.fn().mockResolvedValue([]) }
    })
  })

  it('renders the Playout title', async () => {
    render(<PlayoutPage activeProfile={profile} profiles={profilesProp} playout={playoutProp} />)
    await waitFor(() => expect(screen.getByText('Playout')).toBeInTheDocument())
  })

  it('renders without crashing when activeProfile is null', () => {
    expect(() =>
      render(<PlayoutPage activeProfile={null} profiles={profilesProp} playout={playoutProp} />)
    ).not.toThrow()
  })
})
