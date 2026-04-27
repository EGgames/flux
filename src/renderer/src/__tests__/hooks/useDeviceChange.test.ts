import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useDeviceChange } from '../../hooks/useDeviceChange'

describe('useDeviceChange', () => {
  let listener: (() => void) | null = null
  let devices: MediaDeviceInfo[] = []

  beforeEach(() => {
    listener = null
    devices = [
      { kind: 'audiooutput' } as MediaDeviceInfo,
      { kind: 'audiooutput' } as MediaDeviceInfo,
      { kind: 'audioinput' } as MediaDeviceInfo
    ]
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi.fn(async () => devices),
        addEventListener: vi.fn((ev: string, cb: () => void) => {
          if (ev === 'devicechange') listener = cb
        }),
        removeEventListener: vi.fn(() => { listener = null })
      }
    })
  })

  it('returns initial counts from enumerateDevices', async () => {
    const { result } = renderHook(() => useDeviceChange())
    await waitFor(() => expect(result.current.outputCount).toBe(2))
    expect(result.current.inputCount).toBe(1)
    expect(result.current.changedAt).not.toBeNull()
  })

  it('updates on devicechange event', async () => {
    const { result } = renderHook(() => useDeviceChange())
    await waitFor(() => expect(result.current.outputCount).toBe(2))
    devices = [{ kind: 'audiooutput' } as MediaDeviceInfo]
    await act(async () => { listener?.() })
    await waitFor(() => expect(result.current.outputCount).toBe(1))
    expect(result.current.inputCount).toBe(0)
  })
})
