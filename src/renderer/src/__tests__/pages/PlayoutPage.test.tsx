import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const usePlaylistsMock = vi.fn()
const useProgramsMock = vi.fn()
const useSoundboardMock = vi.fn()
const useWorkspaceLayoutMock = vi.fn()

vi.mock('@renderer/hooks/usePlaylists', () => ({
  usePlaylists: (...args: unknown[]) => usePlaylistsMock(...args)
}))
vi.mock('@renderer/hooks/usePrograms', () => ({
  usePrograms: (...args: unknown[]) => useProgramsMock(...args)
}))
vi.mock('@renderer/hooks/useSoundboard', () => ({
  useSoundboard: (...args: unknown[]) => useSoundboardMock(...args)
}))
vi.mock('@renderer/hooks/useWorkspaceLayout', () => ({
  useWorkspaceLayout: (...args: unknown[]) => useWorkspaceLayoutMock(...args)
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
  default: ({ onAssign, onTrigger }: { onAssign: (slot: number) => void; onTrigger: (slot: number) => void }) => (
    <div data-testid="sb-grid">
      <button onClick={() => onAssign(2)}>Assign 2</button>
      <button onClick={() => onTrigger(4)}>Trigger 4</button>
    </div>
  )
}))
vi.mock('@renderer/pages/ProgramsPage/ProgramsPage', () => ({
  default: () => <div>Programs Mock</div>
}))
vi.mock('@renderer/pages/IntegrationsPage/IntegrationsPage', () => ({
  default: () => <div>Integrations Mock</div>
}))
vi.mock('@renderer/pages/ProfilesPage/ProfilesPage', () => ({
  default: () => <div>Profiles Mock</div>
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

const sbAssignMock = vi.fn().mockResolvedValue(undefined)
const sbTriggerMock = vi.fn()
const sbStopMock = vi.fn()
const sbPauseMock = vi.fn()
const sbResumeMock = vi.fn()

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
  equalizer: { enabled: false, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], presetId: 'flat' },
  equalizerFrequencies: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
  equalizerPresets: [
    { id: 'flat', name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], builtIn: true }
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
    vi.clearAllMocks()

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { enumerateDevices: vi.fn().mockResolvedValue([]) }
    })

    usePlaylistsMock.mockReturnValue({
      playlists: [
        { id: 'pl-1', name: 'Lista Uno' },
        { id: 'pl-2', name: 'Lista Dos' }
      ],
      create: vi.fn(),
      remove: vi.fn(),
      reload: vi.fn()
    })
    useProgramsMock.mockReturnValue({ programs: [{ id: 'prog-1', name: 'Mañana' }] })
    useWorkspaceLayoutMock.mockReturnValue({
      layout: null,
      saveLayout: vi.fn(),
      workspaceHeight: 600,
      saveWorkspaceHeight: vi.fn()
    })
    useSoundboardMock.mockReturnValue({
      buttons: [],
      assign: sbAssignMock,
      trigger: sbTriggerMock,
      stopAll: sbStopMock,
      pauseAll: sbPauseMock,
      resumeAll: sbResumeMock,
      isPaused: false,
      gridResetKey: 0
    })

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: {
        audioAssets: {
          pickFiles: vi.fn().mockResolvedValue(['C:/fx.mp3']),
          importBatch: vi.fn().mockResolvedValue([{ id: 'a-1', name: 'FX 1' }])
        }
      }
    })

    vi.spyOn(window, 'prompt').mockReturnValue('Mi preset')
    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
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

  it('inicia reproducción y cambia lista cuando está activo', async () => {
    render(<PlayoutPage activeProfile={profile} profiles={profilesProp} playout={playoutProp} />)

    fireEvent.change(screen.getByDisplayValue('— Programa activo —'), { target: { value: 'pl-2' } })
    fireEvent.click(screen.getByText('▶ Iniciar'))
    await waitFor(() => expect(playoutProp.start).toHaveBeenCalledWith('p1', 'pl-2'))

    const playingPlayout = {
      ...playoutProp,
      status: { ...status, state: 'playing' as const, queueLength: 3, queueIndex: 1 }
    }
    render(<PlayoutPage activeProfile={profile} profiles={profilesProp} playout={playingPlayout} />)

    fireEvent.change(screen.getAllByDisplayValue('— Programa activo —')[0], { target: { value: 'pl-1' } })
    fireEvent.click(screen.getByText('↪ Cambiar'))
    expect(playingPlayout.changePlaylist).toHaveBeenCalledWith('p1', 'pl-1')
  })

  it('tolera preferences inválidas sin romper ni llamar update', async () => {
    const brokenProfile = { ...profile, preferences: '{not-json' }
    render(<PlayoutPage activeProfile={brokenProfile} profiles={profilesProp} playout={playoutProp} />)

    const select = screen.getByDisplayValue('— Ninguna —')
    fireEvent.change(select, { target: { value: 'pl-1' } })

    await waitFor(() => expect(profilesProp.update).not.toHaveBeenCalled())
  })

  it('actualiza preferences cuando el JSON actual es válido', async () => {
    const goodProfile = { ...profile, preferences: '{}' }
    render(<PlayoutPage activeProfile={goodProfile} profiles={profilesProp} playout={playoutProp} />)

    const select = screen.getByDisplayValue('— Ninguna —')
    fireEvent.change(select, { target: { value: 'pl-1' } })

    await waitFor(() => expect(profilesProp.update).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ preferences: expect.any(String) })
    ))
  })

  it('renderiza now playing, seek y cola con click/double click', () => {
    const queuePlayout = {
      ...playoutProp,
      status: {
        ...status,
        state: 'playing' as const,
        queueIndex: 0,
        queueLength: 2,
        track: {
          id: 't-1',
          name: 'Tema Local',
          sourceType: 'local' as const,
          sourcePath: 'C:/music/tema.mp3',
          durationMs: 120000,
          tags: '["tag1"]',
          createdAt: '',
          updatedAt: ''
        }
      },
      queue: [
        { id: 'q1', name: 'Tema 1', durationMs: 65000 },
        { id: 'q2', name: 'Tema 2', durationMs: null }
      ],
      currentSec: 10,
      durationSec: 80
    }

    render(<PlayoutPage activeProfile={profile} profiles={profilesProp} playout={queuePlayout} />)

    // El nombre del tema aparece en "Now playing" y tambien en el Deck A del Mixer DJ (LIVE).
    expect(screen.getAllByText('Tema Local').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('tema.mp3')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: '' }), { target: { value: '25' } })
    expect(queuePlayout.seek).toHaveBeenCalledWith(25)

    const queueItem = screen.getByText('Tema 2').closest('div')
    fireEvent.doubleClick(queueItem!)
    expect(queuePlayout.jumpTo).toHaveBeenCalledWith(1)
  })

  it('opera controles de transporte y estado de errores/notificaciones', () => {
    const activePlayout = {
      ...playoutProp,
      error: 'falló audio',
      status: { ...status, state: 'playing' as const, queueLength: 2, queueIndex: 0 },
      pendingAdBlock: { id: 'ab1', name: 'Tanda Top' },
      nextAd: { countdownLabel: '00:00:30', atLabel: 'lun 08:30' },
      adBreakTimer: { name: null, elapsedLabel: '00:00:00', remainingLabel: '—' }
    }
    render(<PlayoutPage activeProfile={profile} profiles={profilesProp} playout={activePlayout} />)

    expect(screen.getByText('falló audio')).toBeInTheDocument()
    expect(screen.getByText(/Tanda Top/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('⏹ Detener'))
    fireEvent.click(screen.getByTitle('Siguiente'))
    expect(activePlayout.stop).toHaveBeenCalled()
    expect(activePlayout.next).toHaveBeenCalled()
  })

  it('gestiona eq presets, bandas y acciones de guardar/eliminar/reset', () => {
    const eqPlayout = {
      ...playoutProp,
      equalizer: { enabled: true, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], presetId: 'custom-x' },
      equalizerPresets: [
        { id: 'flat', name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], builtIn: true },
        { id: 'custom-x', name: 'Custom X', gains: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], builtIn: false }
      ]
    }
    render(<PlayoutPage activeProfile={profile} profiles={profilesProp} playout={eqPlayout} />)

    fireEvent.click(screen.getByText('Reset'))
    expect(eqPlayout.resetEqualizer).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Guardar…'))
    expect(eqPlayout.saveEqualizerPreset).toHaveBeenCalledWith('Mi preset')

    fireEvent.click(screen.getByText('Eliminar'))
    expect(eqPlayout.deleteEqualizerPreset).toHaveBeenCalledWith('custom-x')

    const sliders = screen.getAllByRole('slider')
    fireEvent.change(sliders[1], { target: { value: '6' } })
    expect(eqPlayout.setEqualizerBand).toHaveBeenCalled()
  })

  it('opera soundboard y logs panel', async () => {
    const sbPlayout = {
      ...playoutProp,
      logs: [
        { id: 'l1', timestamp: Date.now(), level: 'info' as const, message: 'Evento 1' }
      ]
    }

    render(<PlayoutPage activeProfile={profile} profiles={profilesProp} playout={sbPlayout} />)

    fireEvent.click(screen.getByText('⏹ Stop'))
    fireEvent.click(screen.getByText('⏸ Pausar'))
    expect(sbStopMock).toHaveBeenCalled()
    expect(sbPauseMock).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Assign 2'))
    await waitFor(() => expect(sbAssignMock).toHaveBeenCalledWith(2, { audioAssetId: 'a-1', label: 'FX 1' }))

    fireEvent.click(screen.getByText('Trigger 4'))
    expect(sbTriggerMock).toHaveBeenCalledWith(4)

    expect(screen.getByText('Evento 1')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Limpiar'))
    expect(sbPlayout.clearLogs).toHaveBeenCalled()
  })
})
