import { describe, it, expect, vi, beforeEach } from 'vitest'
import { programService } from '@renderer/services/programService'

describe('programService', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      value: {
        programs: {
          list: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          remove: vi.fn()
        }
      },
      writable: true,
      configurable: true
    })
  })

  it('delegates all program methods', async () => {
    const payload = {
      profileId: 'p1',
      name: 'Morning Show',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:00',
      playlistId: 'pl1',
      priority: 1
    }

    await programService.list('p1')
    await programService.create(payload)
    await programService.update('prog1', { enabled: false })
    await programService.remove('prog1')

    expect(window.electronAPI.programs.list).toHaveBeenCalledWith('p1')
    expect(window.electronAPI.programs.create).toHaveBeenCalledWith(payload)
    expect(window.electronAPI.programs.update).toHaveBeenCalledWith('prog1', { enabled: false })
    expect(window.electronAPI.programs.remove).toHaveBeenCalledWith('prog1')
  })
})
