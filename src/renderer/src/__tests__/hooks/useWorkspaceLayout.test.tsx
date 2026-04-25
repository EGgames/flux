import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWorkspaceLayout } from '@renderer/hooks/useWorkspaceLayout'
import { profileService } from '@renderer/services/profileService'
import type { Profile } from '@renderer/types/ipc.types'

vi.mock('@renderer/services/profileService', () => ({
  profileService: {
    update: vi.fn().mockResolvedValue({})
  }
}))

const updateMock = vi.mocked(profileService.update)

function makeProfile(prefs?: unknown): Profile {
  return {
    id: 'p1',
    name: 'Test',
    isActive: true,
    preferences: prefs === undefined ? null : (typeof prefs === 'string' ? prefs : JSON.stringify(prefs)),
    createdAt: '',
    updatedAt: ''
  } as unknown as Profile
}

describe('useWorkspaceLayout', () => {
  beforeEach(() => {
    updateMock.mockClear()
    updateMock.mockResolvedValue({} as never)
  })

  it('returns defaults when no profile is provided', () => {
    const { result } = renderHook(() => useWorkspaceLayout(null, 'ws', 'ctx'))
    expect(result.current.layout).toEqual({})
    expect(result.current.workspaceHeight).toBe(540)
  })

  it('parses persisted layout and height from profile preferences', () => {
    const profile = makeProfile({
      workspaceLayouts: { ws: { ctx: { panel1: { x: 1, y: 2, w: 3, h: 4 } } } },
      workspaceHeights: { ws: { ctx: 720 } }
    })

    const { result } = renderHook(() => useWorkspaceLayout(profile, 'ws', 'ctx'))

    expect(result.current.layout).toEqual({ panel1: { x: 1, y: 2, w: 3, h: 4 } })
    expect(result.current.workspaceHeight).toBe(720)
  })

  it('handles invalid JSON in preferences gracefully', () => {
    const profile = makeProfile('not-json{')
    const { result } = renderHook(() => useWorkspaceLayout(profile, 'ws', 'ctx'))
    expect(result.current.layout).toEqual({})
    expect(result.current.workspaceHeight).toBe(540)
  })

  it('handles non-object JSON in preferences', () => {
    const profile = makeProfile(123 as unknown as Record<string, unknown>)
    const { result } = renderHook(() => useWorkspaceLayout(profile, 'ws', 'ctx'))
    expect(result.current.layout).toEqual({})
  })

  it('saveLayout updates state and persists merged preferences', async () => {
    const profile = makeProfile({
      workspaceLayouts: { other: { x: { panelA: { x: 0, y: 0, w: 10, h: 10 } } } },
      workspaceHeights: { other: { x: 400 } }
    })

    const { result } = renderHook(() => useWorkspaceLayout(profile, 'ws', 'ctx'))
    const next = { p1: { x: 5, y: 6, w: 7, h: 8 } }

    await act(async () => {
      await result.current.saveLayout(next)
    })

    expect(result.current.layout).toEqual(next)
    expect(updateMock).toHaveBeenCalledTimes(1)
    const [profileId, payload] = updateMock.mock.calls[0]
    expect(profileId).toBe('p1')
    const parsed = JSON.parse((payload as { preferences: string }).preferences)
    expect(parsed.workspaceLayouts.ws.ctx).toEqual(next)
    // preserve unrelated keys
    expect(parsed.workspaceLayouts.other.x.panelA).toBeDefined()
    expect(parsed.workspaceHeights.other.x).toBe(400)
  })

  it('saveWorkspaceHeight updates state and persists merged preferences', async () => {
    const profile = makeProfile({
      workspaceHeights: { ws: { other: 600 } }
    })
    const { result } = renderHook(() => useWorkspaceLayout(profile, 'ws', 'ctx'))

    await act(async () => {
      await result.current.saveWorkspaceHeight(800)
    })

    expect(result.current.workspaceHeight).toBe(800)
    const [, payload] = updateMock.mock.calls[0]
    const parsed = JSON.parse((payload as { preferences: string }).preferences)
    expect(parsed.workspaceHeights.ws.ctx).toBe(800)
    expect(parsed.workspaceHeights.ws.other).toBe(600)
  })

  it('saveLayout/saveWorkspaceHeight skip persistence without profile', async () => {
    const { result } = renderHook(() => useWorkspaceLayout(null, 'ws', 'ctx'))
    await act(async () => {
      await result.current.saveLayout({ p: { x: 0, y: 0, w: 1, h: 1 } })
      await result.current.saveWorkspaceHeight(700)
    })
    expect(updateMock).not.toHaveBeenCalled()
    expect(result.current.workspaceHeight).toBe(700)
  })

  it('reloads layout when contextKey changes', async () => {
    const profile = makeProfile({
      workspaceLayouts: {
        ws: {
          a: { p: { x: 1, y: 1, w: 1, h: 1 } },
          b: { p: { x: 2, y: 2, w: 2, h: 2 } }
        }
      }
    })

    const { result, rerender } = renderHook(
      ({ ctx }: { ctx: string }) => useWorkspaceLayout(profile, 'ws', ctx),
      { initialProps: { ctx: 'a' } }
    )
    expect(result.current.layout).toEqual({ p: { x: 1, y: 1, w: 1, h: 1 } })

    rerender({ ctx: 'b' })
    await waitFor(() => {
      expect(result.current.layout).toEqual({ p: { x: 2, y: 2, w: 2, h: 2 } })
    })
  })
})
