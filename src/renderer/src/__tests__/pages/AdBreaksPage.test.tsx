import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const useAdBlocksMock = vi.fn()
const triggerAdBlockMock = vi.fn().mockResolvedValue(undefined)
const pickFilesMock = vi.fn()
const importBatchMock = vi.fn()
const getWithItemsMock = vi.fn()
const addItemMock = vi.fn()
const removeItemMock = vi.fn()

const createBlockMock = vi.fn().mockResolvedValue(undefined)
const removeBlockMock = vi.fn().mockResolvedValue(undefined)
const createRuleMock = vi.fn().mockResolvedValue(undefined)
const removeRuleMock = vi.fn().mockResolvedValue(undefined)

vi.mock('@renderer/hooks/useAdBlocks', () => ({
  useAdBlocks: (...args: unknown[]) => useAdBlocksMock(...args)
}))
vi.mock('@renderer/services/adBlockService', () => ({
  adBlockService: {
    getWithItems: (...args: unknown[]) => getWithItemsMock(...args),
    addItem: (...args: unknown[]) => addItemMock(...args),
    removeItem: (...args: unknown[]) => removeItemMock(...args)
  }
}))

import AdBreaksPage from '@renderer/pages/AdBreaksPage/AdBreaksPage'

describe('AdBreaksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getWithItemsMock.mockResolvedValue({ id: 'b1', name: 'Tanda 1', items: [] })
    addItemMock.mockResolvedValue(undefined)
    removeItemMock.mockResolvedValue(undefined)

    useAdBlocksMock.mockReturnValue({
      adBlocks: [{ id: 'b1', name: 'Tanda 1' }],
      adRules: [
        { id: 'r1', adBlockId: 'b1', triggerType: 'time', triggerConfig: JSON.stringify({ dayOfWeek: 1, time: '08:00' }), priority: 1 },
        { id: 'r2', adBlockId: 'b1', triggerType: 'time', triggerConfig: 'not-json', priority: 1 },
        { id: 'r3', adBlockId: 'b1', triggerType: 'manual', triggerConfig: 'manual', priority: 1 }
      ],
      createBlock: createBlockMock,
      removeBlock: removeBlockMock,
      createRule: createRuleMock,
      removeRule: removeRuleMock
    })

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: {
        playout: { triggerAdBlock: triggerAdBlockMock },
        audioAssets: {
          pickFiles: pickFilesMock,
          importBatch: importBatchMock
        }
      }
    })
  })

  it('crea una tanda con click y limpia el input', async () => {
    render(<AdBreaksPage profileId="p1" />)
    const input = screen.getByPlaceholderText('Nueva tanda...') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  Tanda X  ' } })
    fireEvent.click(screen.getByText('+ Crear'))

    await waitFor(() => expect(createBlockMock).toHaveBeenCalledWith('Tanda X'))
    expect(input.value).toBe('')
  })

  it('no crea tanda si el nombre está vacío', () => {
    render(<AdBreaksPage profileId="p1" />)
    fireEvent.click(screen.getByText('+ Crear'))
    expect(createBlockMock).not.toHaveBeenCalled()
  })

  it('selecciona tanda, dispara y elimina bloque', async () => {
    render(<AdBreaksPage profileId="p1" />)

    fireEvent.click(screen.getByText('Tanda 1'))
    await waitFor(() => expect(getWithItemsMock).toHaveBeenCalledWith('b1'))
    expect(screen.getByText('Reglas de disparo')).toBeInTheDocument()

    fireEvent.click(screen.getByText('▶ Disparar'))
    expect(triggerAdBlockMock).toHaveBeenCalledWith('b1')

    const removeButtons = screen.getAllByText('✕')
    fireEvent.click(removeButtons[0])
    expect(removeBlockMock).toHaveBeenCalledWith('b1')
  })

  it('importa audios y agrega items secuenciales', async () => {
    getWithItemsMock
      .mockResolvedValueOnce({ id: 'b1', name: 'Tanda 1', items: [{ id: 'i0', position: 0, audioAsset: { id: 'a0', name: 'Previo' } }] })
      .mockResolvedValueOnce({ id: 'b1', name: 'Tanda 1', items: [{ id: 'i1', position: 1, audioAsset: { id: 'a1', name: 'Uno' } }, { id: 'i2', position: 2, audioAsset: { id: 'a2', name: 'Dos' } }] })
    pickFilesMock.mockResolvedValue(['C:/uno.mp3', 'C:/dos.mp3'])
    importBatchMock.mockResolvedValue([{ id: 'a1', name: 'Uno' }, { id: 'a2', name: 'Dos' }])

    render(<AdBreaksPage profileId="p1" />)
    fireEvent.click(screen.getByText('Tanda 1'))
    await waitFor(() => expect(screen.getByText('+ Audio')).toBeInTheDocument())

    fireEvent.click(screen.getByText('+ Audio'))

    await waitFor(() => {
      expect(addItemMock).toHaveBeenNthCalledWith(1, 'b1', 'a1', 1)
      expect(addItemMock).toHaveBeenNthCalledWith(2, 'b1', 'a2', 2)
    })
    expect(importBatchMock).toHaveBeenCalledWith(['C:/uno.mp3', 'C:/dos.mp3'])
  })

  it('muestra error si intenta crear regla de tiempo sin audios', async () => {
    getWithItemsMock.mockResolvedValueOnce({ id: 'b1', name: 'Tanda 1', items: [] })
    render(<AdBreaksPage profileId="p1" />)

    fireEvent.click(screen.getByText('Tanda 1'))
    await waitFor(() => expect(screen.getByText('+ Regla')).toBeInTheDocument())

    fireEvent.click(screen.getByText('+ Regla'))
    expect(screen.getByText('La tanda debe tener al menos 1 archivo de audio antes de crear horarios.')).toBeInTheDocument()
    expect(createRuleMock).not.toHaveBeenCalled()
  })

  it('crea reglas de tiempo múltiples y permite quitar slot', async () => {
    getWithItemsMock.mockResolvedValueOnce({ id: 'b1', name: 'Tanda 1', items: [{ id: 'i1', position: 1, audioAsset: { id: 'a1', name: 'Uno' } }] })
    render(<AdBreaksPage profileId="p1" />)

    fireEvent.click(screen.getByText('Tanda 1'))
    await waitFor(() => expect(screen.getByText('Agregar hora')).toBeInTheDocument())

    const timeInput = screen.getByDisplayValue('08:00') as HTMLInputElement
    fireEvent.change(timeInput, { target: { value: '10:30' } })
    fireEvent.click(screen.getByText('Agregar hora'))
    expect(screen.getByText('10:30')).toBeInTheDocument()

    const slotRemove = screen.getAllByText('✕').find((btn) =>
      btn.parentElement?.textContent?.includes('10:30')
    )
    expect(slotRemove).toBeDefined()
    fireEvent.click(slotRemove!)
    expect(screen.queryByText('10:30')).not.toBeInTheDocument()

    fireEvent.change(timeInput, { target: { value: '12:15' } })
    fireEvent.click(screen.getByText('Agregar hora'))
    fireEvent.click(screen.getByText('+ Regla'))

    await waitFor(() => expect(createRuleMock).toHaveBeenCalledTimes(1))
    expect(createRuleMock.mock.calls[0][0].triggerType).toBe('time')

  })

  it('crea regla no-time y limpia config', async () => {
    getWithItemsMock.mockResolvedValueOnce({ id: 'b1', name: 'Tanda 1', items: [{ id: 'i1', position: 1, audioAsset: { id: 'a1', name: 'Uno' } }] })
    render(<AdBreaksPage profileId="p1" />)

    fireEvent.click(screen.getByText('Tanda 1'))
    await waitFor(() => expect(screen.getByText('+ Regla')).toBeInTheDocument())

    fireEvent.change(screen.getByDisplayValue('Horario'), { target: { value: 'song_count' } })
    const cfgInput = screen.getByPlaceholderText('Ej: 4') as HTMLInputElement
    fireEvent.change(cfgInput, { target: { value: '4' } })
    fireEvent.click(screen.getByText('+ Regla'))

    await waitFor(() => expect(createRuleMock).toHaveBeenCalledWith(expect.objectContaining({
      adBlockId: 'b1',
      triggerType: 'song_count',
      triggerConfig: '4'
    })))
    expect(cfgInput.value).toBe('')
  })

  it('permite borrar regla y item y formatea configs renderizadas', async () => {
    getWithItemsMock.mockResolvedValueOnce({
      id: 'b1',
      name: 'Tanda 1',
      items: [{ id: 'it-1', position: 1, audioAsset: { id: 'a-1', name: 'Audio 1' } }]
    })
    render(<AdBreaksPage profileId="p1" />)

    fireEvent.click(screen.getByText('Tanda 1'))
    await waitFor(() => expect(screen.getByText('Audio 1')).toBeInTheDocument())

    expect(screen.getByText('Lunes 08:00')).toBeInTheDocument()
    expect(screen.getByText('not-json')).toBeInTheDocument()
    expect(screen.getAllByText('manual').length).toBeGreaterThan(0)

    const removeItemBtn = screen.getAllByText('✕').find((btn) => btn.parentElement?.textContent?.includes('Audio 1'))
    fireEvent.click(removeItemBtn!)
    expect(removeItemMock).toHaveBeenCalledWith('it-1')

    const removeRuleBtn = screen.getAllByText('✕').find((btn) => btn.parentElement?.textContent?.includes('manual'))
    fireEvent.click(removeRuleBtn!)
    expect(removeRuleMock).toHaveBeenCalledWith('r3')
  })

  it('muestra estado vacío cuando no hay tandas', () => {
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
    expect(screen.getByText('Selecciona una tanda')).toBeInTheDocument()
  })
})
