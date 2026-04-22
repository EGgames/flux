import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePrograms } from '@renderer/hooks/usePrograms'
import { programService } from '@renderer/services/programService'

vi.mock('@renderer/services/programService', () => ({
  programService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}))

const mocked = vi.mocked(programService)
const program = {
  id: 'pr1',
  profileId: 'p1',
  name: 'Morning',
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '09:00',
  playlistId: null,
  priority: 1,
  enabled: true
}

describe('usePrograms', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not load with null profile', async () => {
    const { result } = renderHook(() => usePrograms(null))
    await act(async () => { await result.current.reload() })
    expect(mocked.list).not.toHaveBeenCalled()

    await act(async () => {
      const created = await result.current.create({
        name: 'NoProfile',
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '11:00'
      })
      expect(created).toBeUndefined()
    })
  })

  it('loads programs and handles create/update/remove', async () => {
    mocked.list.mockResolvedValue([program] as never)
    mocked.create.mockResolvedValue({ ...program, id: 'pr2' } as never)
    mocked.update.mockResolvedValue({ ...program, name: 'Updated' } as never)
    mocked.remove.mockResolvedValue({ success: true } as never)

    const { result } = renderHook(() => usePrograms('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.programs).toHaveLength(1)

    await act(async () => {
      await result.current.create({
        name: 'Night',
        dayOfWeek: 2,
        startTime: '20:00',
        endTime: '22:00'
      })
    })
    expect(result.current.programs).toHaveLength(2)

    await act(async () => { await result.current.update('pr1', { name: 'Updated' }) })
    expect(result.current.programs.find((p) => p.id === 'pr1')?.name).toBe('Updated')

    await act(async () => { await result.current.remove('pr1') })
    expect(result.current.programs.find((p) => p.id === 'pr1')).toBeUndefined()
  })
})
