import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePlaylists } from '@renderer/hooks/usePlaylists'
import { playlistService } from '@renderer/services/playlistService'

vi.mock('@renderer/services/playlistService', () => ({
  playlistService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getWithItems: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    reorder: vi.fn()
  }
}))

const mocked = vi.mocked(playlistService)
const playlist = { id: 'pl1', name: 'Main', profileId: 'p1', enabled: true, createdAt: '', updatedAt: '' }

describe('usePlaylists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not load when profile is null', async () => {
    const { result } = renderHook(() => usePlaylists(null))
    await act(async () => { await result.current.reload() })
    expect(mocked.list).not.toHaveBeenCalled()
    expect(result.current.playlists).toEqual([])

    await act(async () => {
      const created = await result.current.create('NoProfile')
      expect(created).toBeUndefined()
    })
  })

  it('loads playlists by profile', async () => {
    mocked.list.mockResolvedValue([playlist] as never)
    const { result } = renderHook(() => usePlaylists('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocked.list).toHaveBeenCalledWith('p1')
    expect(result.current.playlists).toHaveLength(1)
  })

  it('creates and removes playlist', async () => {
    mocked.list.mockResolvedValue([playlist] as never)
    mocked.create.mockResolvedValue({ ...playlist, id: 'pl2' } as never)
    mocked.remove.mockResolvedValue({ success: true } as never)

    const { result } = renderHook(() => usePlaylists('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.create('Night') })
    expect(result.current.playlists).toHaveLength(2)

    await act(async () => { await result.current.remove('pl1') })
    expect(mocked.remove).toHaveBeenCalledWith('pl1')
    expect(result.current.playlists.find((p) => p.id === 'pl1')).toBeUndefined()
  })
})
