import { describe, it, expect, vi, beforeEach } from 'vitest'
import { playlistService } from '@renderer/services/playlistService'

function buildElectronMock() {
  return {
    playlists: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getWithItems: vi.fn(),
      addItem: vi.fn(),
      removeItem: vi.fn(),
      reorder: vi.fn()
    }
  }
}

describe('playlistService', () => {
  let electronMock: ReturnType<typeof buildElectronMock>

  beforeEach(() => {
    electronMock = buildElectronMock()
    Object.defineProperty(window, 'electronAPI', {
      value: electronMock,
      writable: true,
      configurable: true
    })
  })

  it('delegates list by profile id', async () => {
    electronMock.playlists.list.mockResolvedValue([])

    await playlistService.list('profile-1')

    expect(electronMock.playlists.list).toHaveBeenCalledWith('profile-1')
  })

  it('delegates create with payload', async () => {
    electronMock.playlists.create.mockResolvedValue({ id: 'pl-1' })

    await playlistService.create('Morning', 'profile-1')

    expect(electronMock.playlists.create).toHaveBeenCalledWith({ name: 'Morning', profileId: 'profile-1' })
  })

  it('delegates update with id and data', async () => {
    electronMock.playlists.update.mockResolvedValue({ id: 'pl-1', enabled: false })

    await playlistService.update('pl-1', { enabled: false })

    expect(electronMock.playlists.update).toHaveBeenCalledWith('pl-1', { enabled: false })
  })

  it('delegates remove by id', async () => {
    electronMock.playlists.remove.mockResolvedValue({ success: true })

    await playlistService.remove('pl-1')

    expect(electronMock.playlists.remove).toHaveBeenCalledWith('pl-1')
  })

  it('delegates getWithItems by id', async () => {
    electronMock.playlists.getWithItems.mockResolvedValue({ id: 'pl-1', items: [] })

    await playlistService.getWithItems('pl-1')

    expect(electronMock.playlists.getWithItems).toHaveBeenCalledWith('pl-1')
  })

  it('delegates addItem with ordered payload', async () => {
    electronMock.playlists.addItem.mockResolvedValue({ id: 'item-1' })

    await playlistService.addItem('pl-1', 'asset-1', 3)

    expect(electronMock.playlists.addItem).toHaveBeenCalledWith('pl-1', 'asset-1', 3)
  })

  it('delegates reorder with item ids', async () => {
    electronMock.playlists.reorder.mockResolvedValue({ success: true })

    await playlistService.reorder('pl-1', ['i1', 'i2'])

    expect(electronMock.playlists.reorder).toHaveBeenCalledWith('pl-1', ['i1', 'i2'])
  })

  it('delegates removeItem by id', async () => {
    electronMock.playlists.removeItem.mockResolvedValue({ success: true })

    await playlistService.removeItem('item-1')

    expect(electronMock.playlists.removeItem).toHaveBeenCalledWith('item-1')
  })
})
