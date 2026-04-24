import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TitleBar from '@renderer/components/TitleBar/TitleBar'

const minimize = vi.fn()
const maximize = vi.fn().mockResolvedValue(undefined)
const close = vi.fn()
const isMaximized = vi.fn()

beforeEach(() => {
  minimize.mockClear()
  maximize.mockClear().mockResolvedValue(undefined)
  close.mockClear()
  isMaximized.mockReset().mockResolvedValue(false)

  Object.defineProperty(window, 'electronAPI', {
    value: { windowControls: { minimize, maximize, close, isMaximized } },
    writable: true,
    configurable: true
  })
})

describe('TitleBar', () => {
  it('renders three window control buttons', async () => {
    render(<TitleBar />)
    expect(await screen.findByTitle('Minimizar')).toBeInTheDocument()
    expect(screen.getByTitle('Maximizar')).toBeInTheDocument()
    expect(screen.getByTitle('Cerrar')).toBeInTheDocument()
  })

  it('invokes minimize / close handlers', async () => {
    render(<TitleBar />)
    fireEvent.click(await screen.findByTitle('Minimizar'))
    fireEvent.click(screen.getByTitle('Cerrar'))
    expect(minimize).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('toggles maximize/restore label after click', async () => {
    isMaximized.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    render(<TitleBar />)
    const btn = await screen.findByTitle('Maximizar')
    fireEvent.click(btn)
    expect(maximize).toHaveBeenCalled()
    expect(await screen.findByTitle('Restaurar')).toBeInTheDocument()
  })
})
