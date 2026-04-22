import { describe, it, expect, vi, beforeEach } from 'vitest'
import { outputService } from '@renderer/services/outputService'

function buildElectronMock() {
  return {
    outputs: {
      list: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
      test: vi.fn(),
      toggleEnabled: vi.fn()
    }
  }
}

describe('outputService', () => {
  let electronMock: ReturnType<typeof buildElectronMock>

  beforeEach(() => {
    electronMock = buildElectronMock()
    Object.defineProperty(window, 'electronAPI', {
      value: electronMock,
      writable: true,
      configurable: true
    })
  })

  it('delegates all output methods', async () => {
    await outputService.list('p1')
    await outputService.save({ profileId: 'p1', outputType: 'icecast', config: '{}' })
    await outputService.remove('o1')
    await outputService.test('o1')
    await outputService.toggleEnabled('o1', true)

    expect(electronMock.outputs.list).toHaveBeenCalledWith('p1')
    expect(electronMock.outputs.save).toHaveBeenCalledWith({ profileId: 'p1', outputType: 'icecast', config: '{}' })
    expect(electronMock.outputs.remove).toHaveBeenCalledWith('o1')
    expect(electronMock.outputs.test).toHaveBeenCalledWith('o1')
    expect(electronMock.outputs.toggleEnabled).toHaveBeenCalledWith('o1', true)
  })
})
