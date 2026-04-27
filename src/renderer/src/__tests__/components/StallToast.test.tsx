import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import StallToast from '../../components/Toast/StallToast'

interface Listener { ch: string; cb: (...args: unknown[]) => void }

describe('StallToast', () => {
  let listeners: Listener[]
  beforeEach(() => {
    vi.useFakeTimers()
    listeners = []
    ;(window as unknown as { electronAPI: unknown }).electronAPI = {
      on: vi.fn((ch: string, cb: (...args: unknown[]) => void) => {
        listeners.push({ ch, cb })
      }),
      off: vi.fn((ch: string, cb: (...args: unknown[]) => void) => {
        const i = listeners.findIndex((l) => l.ch === ch && l.cb === cb)
        if (i >= 0) listeners.splice(i, 1)
      })
    }
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not render when no event received', () => {
    render(<StallToast />)
    expect(screen.queryByTestId('stall-toast')).toBeNull()
  })

  it('renders when playout:stall fires', () => {
    render(<StallToast />)
    act(() => {
      listeners.find((l) => l.ch === 'playout:stall')?.cb({ trackId: 't1', reason: 'no_progress' })
    })
    const toast = screen.getByTestId('stall-toast')
    expect(toast.textContent).toMatch(/no_progress/)
  })

  it('auto hides after 6 seconds', () => {
    render(<StallToast />)
    act(() => {
      listeners.find((l) => l.ch === 'playout:stall')?.cb({ trackId: 't1', reason: 'no_progress' })
    })
    expect(screen.getByTestId('stall-toast')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.queryByTestId('stall-toast')).toBeNull()
  })

  it('ignores payload without trackId', () => {
    render(<StallToast />)
    act(() => {
      listeners.find((l) => l.ch === 'playout:stall')?.cb({})
    })
    expect(screen.queryByTestId('stall-toast')).toBeNull()
  })
})
