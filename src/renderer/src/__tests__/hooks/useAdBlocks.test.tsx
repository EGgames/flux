import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAdBlocks } from '@renderer/hooks/useAdBlocks'
import { adBlockService } from '@renderer/services/adBlockService'

vi.mock('@renderer/services/adBlockService', () => ({
  adBlockService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getWithItems: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    trigger: vi.fn(),
    listRules: vi.fn(),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    removeRule: vi.fn()
  }
}))

const mocked = vi.mocked(adBlockService)
const block = { id: 'b1', name: 'Block', profileId: 'p1', enabled: true, createdAt: '', updatedAt: '' }
const rule = { id: 'r1', profileId: 'p1', adBlockId: 'b1', triggerType: 'manual', triggerConfig: 'manual', priority: 1, enabled: true }

describe('useAdBlocks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not load with null profile', async () => {
    const { result } = renderHook(() => useAdBlocks(null))
    await act(async () => { await result.current.reload() })
    expect(mocked.list).not.toHaveBeenCalled()

    await act(async () => {
      const block = await result.current.createBlock('Block')
      const rule = await result.current.createRule({
        adBlockId: 'b1',
        triggerType: 'manual',
        triggerConfig: 'manual',
        priority: 1
      })
      expect(block).toBeUndefined()
      expect(rule).toBeUndefined()
    })
  })

  it('loads blocks and rules', async () => {
    mocked.list.mockResolvedValue([block] as never)
    mocked.listRules.mockResolvedValue([rule] as never)

    const { result } = renderHook(() => useAdBlocks('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.adBlocks).toHaveLength(1)
    expect(result.current.adRules).toHaveLength(1)
  })

  it('creates/removes blocks and rules', async () => {
    mocked.list.mockResolvedValue([block] as never)
    mocked.listRules.mockResolvedValue([rule] as never)
    mocked.create.mockResolvedValue({ ...block, id: 'b2' } as never)
    mocked.createRule.mockResolvedValue({ ...rule, id: 'r2' } as never)
    mocked.remove.mockResolvedValue({ success: true } as never)
    mocked.removeRule.mockResolvedValue({ success: true } as never)

    const { result } = renderHook(() => useAdBlocks('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.createBlock('B2') })
    await act(async () => {
      await result.current.createRule({
        adBlockId: 'b1',
        triggerType: 'time',
        triggerConfig: '10:30',
        priority: 2
      })
    })
    expect(result.current.adBlocks).toHaveLength(2)
    expect(result.current.adRules).toHaveLength(2)

    await act(async () => { await result.current.removeBlock('b1') })
    await act(async () => { await result.current.removeRule('r1') })
    expect(result.current.adBlocks.find((b) => b.id === 'b1')).toBeUndefined()
    expect(result.current.adRules.find((r) => r.id === 'r1')).toBeUndefined()
  })
})
