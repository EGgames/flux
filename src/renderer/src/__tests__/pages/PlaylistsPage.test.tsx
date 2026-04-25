import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const usePlaylists = vi.fn()
const usePrograms = vi.fn()
const useWorkspaceLayout = vi.fn()
const getWithItemsMock = vi.fn()
const addItemMock = vi.fn()
const removeItemMock = vi.fn()

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
    getWithItems: (...args: unknown[]) => getWithItemsMock(...args),
    addItem: (...args: unknown[]) => addItemMock(...args),
    removeItem: (...args: unknown[]) => removeItemMock(...args),
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

const createMock = vi.fn().mockResolvedValue(undefined)
const removeMock = vi.fn().mockResolvedValue(undefined)
const reloadMock = vi.fn()

function buildDropEvent(paths: string[]) {
  const files = paths.map((path, idx) => {
    const file = new File(['x'], `file-${idx}.mp3`, { type: 'audio/mpeg' }) as File & { path?: string }
    file.path = path
    return file
  })
  return {
    preventDefault: vi.fn(),
    dataTransfer: { files }
  }
}

describe('PlaylistsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePlaylists.mockReturnValue({
      playlists: [{ id: 'pl1', name: 'Lista A' }],
      create: createMock,
      remove: removeMock,
      reload: reloadMock
    })
    usePrograms.mockReturnValue({ programs: [{ id: 'prog-1', name: 'Mañana' }] })
    useWorkspaceLayout.mockReturnValue({
      layout: null,
      saveLayout: vi.fn(),
      workspaceHeight: 600,
      saveWorkspaceHeight: vi.fn()
    })

    getWithItemsMock.mockResolvedValue({
      id: 'pl1',
      name: 'Lista A',
      items: [
        {
          id: 'it-1',
          position: 1,
          audioAsset: { id: 'a-1', name: 'Tema Uno', durationMs: 65000, tags: '["rock"]' }
        }
      ]
    })
    addItemMock.mockResolvedValue(undefined)
    removeItemMock.mockResolvedValue(undefined)

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: {
        audioAssets: {
          pickFiles: vi.fn().mockResolvedValue(['C:/uno.mp3']),
          importBatch: vi.fn().mockResolvedValue([{ id: 'a-99', name: 'Nuevo' }])
        }
      }
    })

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
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

  it('crea playlist con Enter y no crea con nombre vacío', async () => {
    render(<PlaylistsPage activeProfile={profile} playout={playoutProp} />)

    const input = screen.getByPlaceholderText('Nueva playlist...') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(createMock).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '  Lista Nueva  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(createMock).toHaveBeenCalledWith('Lista Nueva'))
  })

  it('selecciona playlist y permite agregar audio por picker', async () => {
    render(<PlaylistsPage activeProfile={profile} playout={playoutProp} />)
    fireEvent.click(screen.getByText('Lista A'))

    await waitFor(() => expect(getWithItemsMock).toHaveBeenCalledWith('pl1'))
    expect(screen.getByText('Tema Uno')).toBeInTheDocument()
    expect(screen.getByText('1:05')).toBeInTheDocument()

    fireEvent.click(screen.getByText('+ Agregar audio'))

    await waitFor(() => expect(addItemMock).toHaveBeenCalledWith('pl1', 'a-99', 1))
    expect(reloadMock).toHaveBeenCalled()
  })

  it('muestra feedback de drop cuando no hay selección o sin audios compatibles', async () => {
    render(<PlaylistsPage activeProfile={profile} playout={playoutProp} />)

    const dz = screen.getByText('Arrastra archivos de audio directamente desde cualquier carpeta del sistema.').parentElement
    const firstDrop = buildDropEvent(['C:/imagen.png'])
    fireEvent.drop(dz!, firstDrop)
    expect(await screen.findByText('Primero selecciona una playlist para importar.')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Lista A'))
    await waitFor(() => expect(screen.getByText('Tema Uno')).toBeInTheDocument())

    const secondDrop = buildDropEvent(['C:/notas.txt'])
    fireEvent.drop(dz!, secondDrop)
    expect(await screen.findByText('No se detectaron archivos de audio compatibles.')).toBeInTheDocument()
  })

  it('importa por drop externo y muestra contador de importados', async () => {
    ;(window.electronAPI.audioAssets.importBatch as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'a-10', name: 'A' }, { id: 'a-11', name: 'B' }])
    getWithItemsMock
      .mockResolvedValueOnce({ id: 'pl1', name: 'Lista A', items: [] })
      .mockResolvedValueOnce({ id: 'pl1', name: 'Lista A', items: [] })

    render(<PlaylistsPage activeProfile={profile} playout={playoutProp} />)
    fireEvent.click(screen.getByText('Lista A'))
    await waitFor(() => expect(screen.getByText('+ Agregar audio')).toBeInTheDocument())

    const dz = screen.getByText('Arrastra archivos de audio directamente desde cualquier carpeta del sistema.').parentElement
    fireEvent.drop(dz!, buildDropEvent(['C:/uno.mp3', 'C:/dos.wav']))

    await waitFor(() => {
      expect(addItemMock).toHaveBeenNthCalledWith(1, 'pl1', 'a-10', 0)
      expect(addItemMock).toHaveBeenNthCalledWith(2, 'pl1', 'a-11', 1)
    })
    expect(screen.getByText('2 archivo(s) importado(s) desde carpeta externa.')).toBeInTheDocument()
  })

  it('hace start desde doble click cuando no está reproduciendo esa playlist', async () => {
    render(<PlaylistsPage activeProfile={profile} playout={playoutProp} />)
    fireEvent.click(screen.getByText('Lista A'))
    await waitFor(() => expect(screen.getByText('Tema Uno')).toBeInTheDocument())

    const track = screen.getByText('Tema Uno').closest('div')
    fireEvent.doubleClick(track!)
    await waitFor(() => expect(playoutProp.start).toHaveBeenCalledWith('p1', 'pl1', 0))
  })

  it('usa jumpTo desde doble click cuando ya reproduce esa playlist', async () => {
    const playingPlayout = {
      ...playoutProp,
      status: { ...status, state: 'playing' as const, queueLength: 1, queueIndex: 0 }
    }
    render(<PlaylistsPage activeProfile={profile} playout={playingPlayout} />)
    fireEvent.click(screen.getByText('Lista A'))
    await waitFor(() => expect(screen.getByText('Tema Uno')).toBeInTheDocument())
    const track2 = screen.getByText('Tema Uno').closest('div')
    fireEvent.doubleClick(track2!)
    await waitFor(() => expect(playingPlayout.jumpTo).toHaveBeenCalledWith(0))
  })

  it('elimina item y playlist', async () => {
    render(<PlaylistsPage activeProfile={profile} playout={playoutProp} />)
    fireEvent.click(screen.getByText('Lista A'))
    await waitFor(() => expect(screen.getByText('Tema Uno')).toBeInTheDocument())

    const removeTrackBtn = screen.getAllByText('✕').find((btn) => btn.parentElement?.textContent?.includes('Tema Uno'))
    fireEvent.click(removeTrackBtn!)
    await waitFor(() => expect(removeItemMock).toHaveBeenCalledWith('it-1'))

    const removePlaylistBtn = screen.getAllByText('✕').find((btn) => btn.parentElement?.textContent?.includes('Lista A'))
    fireEvent.click(removePlaylistBtn!)
    expect(removeMock).toHaveBeenCalledWith('pl1')
  })

  it('renderiza estado sin playlists y sin pistas', async () => {
    usePlaylists.mockReturnValue({ playlists: [], create: createMock, remove: removeMock, reload: reloadMock })
    getWithItemsMock.mockResolvedValue({ id: 'pl1', name: 'Lista A', items: [] })

    render(<PlaylistsPage activeProfile={profile} playout={playoutProp} />)
    expect(screen.getByText('Sin playlists')).toBeInTheDocument()
    expect(screen.getByText('Selecciona una playlist')).toBeInTheDocument()
  })

  it('renders without crashing when activeProfile is null', () => {
    expect(() =>
      render(<PlaylistsPage activeProfile={null} playout={playoutProp} />)
    ).not.toThrow()
  })
})
