import { describe, it, expect, vi, beforeEach } from 'vitest'
import { profileService } from '@renderer/services/profileService'

function buildElectronMock() {
  return {
    profiles: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      select: vi.fn()
    }
  }
}

describe('profileService', () => {
  let electronMock: ReturnType<typeof buildElectronMock>

  beforeEach(() => {
    electronMock = buildElectronMock()
    Object.defineProperty(window, 'electronAPI', {
      value: electronMock,
      writable: true,
      configurable: true
    })
  })

  it('delegates list to electronAPI', async () => {
    const profiles = [{ id: 'p1', name: 'Default' }]
    electronMock.profiles.list.mockResolvedValue(profiles)

    const result = await profileService.list()

    expect(electronMock.profiles.list).toHaveBeenCalledTimes(1)
    expect(result).toEqual(profiles)
  })

  it('delegates create with name payload', async () => {
    const created = { id: 'p2', name: 'New' }
    electronMock.profiles.create.mockResolvedValue(created)

    const result = await profileService.create('New')

    expect(electronMock.profiles.create).toHaveBeenCalledWith({ name: 'New' })
    expect(result).toEqual(created)
  })

  it('delegates update with id and payload', async () => {
    electronMock.profiles.update.mockResolvedValue({ id: 'p1', name: 'Edited' })

    await profileService.update('p1', { name: 'Edited' })

    expect(electronMock.profiles.update).toHaveBeenCalledWith('p1', { name: 'Edited' })
  })

  it('delegates remove with profile id', async () => {
    electronMock.profiles.remove.mockResolvedValue({ success: true })

    await profileService.remove('p1')

    expect(electronMock.profiles.remove).toHaveBeenCalledWith('p1')
  })

  it('delegates select with profile id', async () => {
    electronMock.profiles.select.mockResolvedValue({ id: 'p1', name: 'Default' })

    await profileService.select('p1')

    expect(electronMock.profiles.select).toHaveBeenCalledWith('p1')
  })
})
