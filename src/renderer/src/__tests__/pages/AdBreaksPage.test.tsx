import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const useAdBlocksMock = vi.fn()
const triggerAdBlockMock = vi.fn().mockResolvedValue(undefined)
const removeBlockMock = vi.fn()
const removeRuleMock = vi.fn()

vi.mock('@renderer/hooks/useAdBlocks', () => ({
  useAdBlocks: (...args: unknown[]) => useAdBlocksMock(...args)
}))
vi.mock('@renderer/services/adBlockService', () => ({
  adBlockService: {
    getWithItems: vi.fn().mockResolvedValue({ items: [] }),
    addItem: vi.fn(),
    removeItem: vi.fn()
  }
}))

import AdBreaksPage from '@renderer/pages/AdBreaksPage/AdBreaksPage'

describe('AdBreaksPage', () => {
  beforeEach(() => {
    useAdBlocksMock.mockReturnValue({
      adBlocks: [{ id: 'b1', name: 'Tanda 1' }],
      adRules: [],
      createBlock: vi.fn(),
      removeBlock: removeBlockMock,
      createRule: vi.fn(),
      removeRule: removeRuleMock
    })
    Object.assign(globalThis, {
      window: Object.assign(globalThis.window ?? {}, {
        electronAPI: {
          playout: { triggerAdBlock: triggerAdBlockMock },
          audioAssets: { pickFiles: vi.fn(), importBatch: vi.fn() }
        }
      })
    })
  })

  it('renders ad block list', () => {
    render(<AdBreaksPage profileId="p1" />)
    expect(screen.getByText('Tanda 1')).toBeInTheDocument()
  })

  it('shows "▶ Disparar" button per ad block', () => {
    render(<AdBreaksPage profileId="p1" />)
    expect(screen.getByText('▶ Disparar')).toBeInTheDocument()
  })

  it('calls triggerAdBlock on Disparar click and stops propagation', () => {
    render(<AdBreaksPage profileId="p1" />)
    fireEvent.click(screen.getByText('▶ Disparar'))
    expect(triggerAdBlockMock).toHaveBeenCalledWith('b1')
  })

  it('calls removeBlock when ✕ is clicked', () => {
    render(<AdBreaksPage profileId="p1" />)
    const removeButtons = screen.getAllByText('✕')
    fireEvent.click(removeButtons[0])
    expect(removeBlockMock).toHaveBeenCalledWith('b1')
  })

  it('shows empty state when there are no ad blocks', () => {
    useAdBlocksMock.mockReturnValue({
      adBlocks: [],
      adRules: [],
      createBlock: vi.fn(),
      removeBlock: vi.fn(),
      createRule: vi.fn(),
      removeRule: vi.fn()
    })
    render(<AdBreaksPage profileId="p1" />)
    expect(screen.getByText('Sin tandas')).toBeInTheDocument()
  })
})
