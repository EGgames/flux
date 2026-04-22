import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adBlockService } from '@renderer/services/adBlockService'

function buildElectronMock() {
  return {
    adBlocks: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getWithItems: vi.fn(),
      addItem: vi.fn(),
      removeItem: vi.fn(),
      trigger: vi.fn()
    },
    adRules: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn()
    }
  }
}

describe('adBlockService', () => {
  let electronMock: ReturnType<typeof buildElectronMock>

  beforeEach(() => {
    electronMock = buildElectronMock()
    Object.defineProperty(window, 'electronAPI', {
      value: electronMock,
      writable: true,
      configurable: true
    })
  })

  it('delegates ad blocks CRUD and items', async () => {
    await adBlockService.list('p1')
    await adBlockService.create('Block A', 'p1')
    await adBlockService.update('b1', { enabled: true })
    await adBlockService.remove('b1')
    await adBlockService.getWithItems('b1')
    await adBlockService.addItem('b1', 'a1', 0)
    await adBlockService.removeItem('i1')
    await adBlockService.trigger('b1')

    expect(electronMock.adBlocks.list).toHaveBeenCalledWith('p1')
    expect(electronMock.adBlocks.create).toHaveBeenCalledWith({ name: 'Block A', profileId: 'p1' })
    expect(electronMock.adBlocks.update).toHaveBeenCalledWith('b1', { enabled: true })
    expect(electronMock.adBlocks.remove).toHaveBeenCalledWith('b1')
    expect(electronMock.adBlocks.getWithItems).toHaveBeenCalledWith('b1')
    expect(electronMock.adBlocks.addItem).toHaveBeenCalledWith('b1', 'a1', 0)
    expect(electronMock.adBlocks.removeItem).toHaveBeenCalledWith('i1')
    expect(electronMock.adBlocks.trigger).toHaveBeenCalledWith('b1')
  })

  it('delegates ad rules CRUD', async () => {
    await adBlockService.listRules('p1')
    await adBlockService.createRule({
      profileId: 'p1',
      adBlockId: 'b1',
      triggerType: 'manual',
      triggerConfig: 'manual',
      priority: 1
    })
    await adBlockService.updateRule('r1', { enabled: false })
    await adBlockService.removeRule('r1')

    expect(electronMock.adRules.list).toHaveBeenCalledWith('p1')
    expect(electronMock.adRules.create).toHaveBeenCalledWith({
      profileId: 'p1',
      adBlockId: 'b1',
      triggerType: 'manual',
      triggerConfig: 'manual',
      priority: 1
    })
    expect(electronMock.adRules.update).toHaveBeenCalledWith('r1', { enabled: false })
    expect(electronMock.adRules.remove).toHaveBeenCalledWith('r1')
  })
})
