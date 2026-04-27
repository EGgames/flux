import { describe, it, expect } from 'vitest'
import { StreamingService } from '../../services/streamingService'

describe('StreamingService.computeBackoff', () => {
  it('comienza en baseMs', () => {
    expect(StreamingService.computeBackoff(0)).toBe(1000)
  })

  it('duplica en cada intento', () => {
    expect(StreamingService.computeBackoff(1)).toBe(2000)
    expect(StreamingService.computeBackoff(2)).toBe(4000)
    expect(StreamingService.computeBackoff(3)).toBe(8000)
    expect(StreamingService.computeBackoff(4)).toBe(16000)
    expect(StreamingService.computeBackoff(5)).toBe(32000)
  })

  it('aplica el cap MAX_BACKOFF_MS', () => {
    expect(StreamingService.computeBackoff(6)).toBe(60000)
    expect(StreamingService.computeBackoff(20)).toBe(60000)
  })

  it('respeta cap personalizado', () => {
    expect(StreamingService.computeBackoff(10, 100, 5000)).toBe(5000)
  })

  it('trata negativos como 0', () => {
    expect(StreamingService.computeBackoff(-3)).toBe(1000)
  })
})
