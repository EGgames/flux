import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useProfiles } from '@renderer/hooks/useProfiles'
import { profileService } from '@renderer/services/profileService'

vi.mock('@renderer/services/profileService', () => ({
  profileService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    select: vi.fn()
  }
}))

const mockedProfileService = vi.mocked(profileService)

const profileA = {
  id: 'p1',
  name: 'A',
  isDefault: true,
  preferences: '{}',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

const profileB = {
  id: 'p2',
  name: 'B',
  isDefault: false,
  preferences: '{}',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('useProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads profiles and sets active default profile', async () => {
    mockedProfileService.list.mockResolvedValue([profileA, profileB])

    const { result } = renderHook(() => useProfiles())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.profiles).toHaveLength(2)
    expect(result.current.activeProfile?.id).toBe('p1')
    expect(result.current.error).toBeNull()
  })

  it('sets error when load fails', async () => {
    mockedProfileService.list.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useProfiles())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('boom')
    expect(result.current.profiles).toEqual([])
  })

  it('falls back to first profile when no default is set', async () => {
    mockedProfileService.list.mockResolvedValue([{ ...profileA, isDefault: false }, profileB])

    const { result } = renderHook(() => useProfiles())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.activeProfile?.id).toBe('p1')
  })

  it('sets active profile to null when list is empty', async () => {
    mockedProfileService.list.mockResolvedValue([])

    const { result } = renderHook(() => useProfiles())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.activeProfile).toBeNull()
  })

  it('uses generic message when load throws non-Error', async () => {
    mockedProfileService.list.mockRejectedValue('plain-error')

    const { result } = renderHook(() => useProfiles())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Error al cargar perfiles')
  })

  it('creates and appends a profile', async () => {
    mockedProfileService.list.mockResolvedValue([profileA])
    mockedProfileService.create.mockResolvedValue(profileB)

    const { result } = renderHook(() => useProfiles())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.create('B')
    })

    expect(mockedProfileService.create).toHaveBeenCalledWith('B')
    expect(result.current.profiles).toHaveLength(2)
    expect(result.current.profiles[1].id).toBe('p2')
  })

  it('selects profile and updates active state', async () => {
    mockedProfileService.list.mockResolvedValue([profileA, profileB])
    mockedProfileService.select.mockResolvedValue({ ...profileB, isDefault: true })

    const { result } = renderHook(() => useProfiles())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.select('p2')
    })

    expect(mockedProfileService.select).toHaveBeenCalledWith('p2')
    expect(result.current.activeProfile?.id).toBe('p2')
    expect(result.current.profiles.find((p) => p.id === 'p2')?.isDefault).toBe(true)
  })

  it('removes active profile and clears active state', async () => {
    mockedProfileService.list.mockResolvedValue([profileA])
    mockedProfileService.remove.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useProfiles())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.remove('p1')
    })

    expect(mockedProfileService.remove).toHaveBeenCalledWith('p1')
    expect(result.current.profiles).toEqual([])
    expect(result.current.activeProfile).toBeNull()
  })
})
