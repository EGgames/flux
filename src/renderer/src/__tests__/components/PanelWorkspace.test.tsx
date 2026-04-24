import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PanelWorkspace, { type PanelConfig } from '@renderer/components/PanelWorkspace/PanelWorkspace'

function makePanels(): PanelConfig[] {
  return [
    { id: 'a', title: 'Panel A', defaultRect: { x: 0, y: 0, w: 200, h: 150 }, content: <div>contenido A</div> },
    { id: 'b', title: 'Panel B', defaultRect: { x: 220, y: 0, w: 200, h: 150 }, content: <div>contenido B</div> }
  ]
}

beforeEach(() => {
  // Forzar viewport amplio para el modo no-mobile
  Object.defineProperty(window, 'innerWidth', { value: 1400, configurable: true, writable: true })
})

describe('PanelWorkspace', () => {
  it('renders all panel titles and content', () => {
    render(<PanelWorkspace panels={makePanels()} />)
    expect(screen.getByText('Panel A')).toBeInTheDocument()
    expect(screen.getByText('contenido A')).toBeInTheDocument()
    expect(screen.getByText('Panel B')).toBeInTheDocument()
  })

  it('uses savedLayout when provided', () => {
    const saved = { a: { x: 50, y: 60, w: 300, h: 220 } }
    render(<PanelWorkspace panels={makePanels()} savedLayout={saved} />)
    // panel A se renderiza con el rect persistido
    const headers = screen.getAllByText('Mover')
    expect(headers).toHaveLength(2)
  })

  it('closes a panel and shows it again via "Añadir panel" menu', () => {
    const onLayoutChange = vi.fn()
    render(<PanelWorkspace panels={makePanels()} onLayoutChange={onLayoutChange} />)

    // Cerrar Panel A
    fireEvent.click(screen.getByTitle('Cerrar Panel A'))
    expect(screen.queryByText('contenido A')).not.toBeInTheDocument()

    // Aparece el botón de añadir
    fireEvent.click(screen.getByText('+ Añadir panel'))
    fireEvent.click(screen.getByText('Panel A'))
    expect(screen.getByText('contenido A')).toBeInTheDocument()
  })

  it('invokes onWorkspaceHeightChange via slider, +/- buttons', () => {
    const onHeight = vi.fn()
    render(
      <PanelWorkspace
        panels={makePanels()}
        workspaceHeight={500}
        minWorkspaceHeight={200}
        maxWorkspaceHeight={800}
        onWorkspaceHeightChange={onHeight}
      />
    )

    fireEvent.click(screen.getByText('+'))
    expect(onHeight).toHaveBeenLastCalledWith(580)

    fireEvent.click(screen.getByText('-'))
    expect(onHeight).toHaveBeenLastCalledWith(420)

    const slider = screen.getByLabelText('Tamaño del área de ventanas') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '700' } })
    expect(onHeight).toHaveBeenLastCalledWith(700)

    // Clamp al máximo
    fireEvent.change(slider, { target: { value: '9999' } })
    expect(onHeight).toHaveBeenLastCalledWith(800)
  })

  it('Auto-ajustar reorganiza paneles y dispara onLayoutChange', () => {
    const onLayoutChange = vi.fn()
    render(<PanelWorkspace panels={makePanels()} onLayoutChange={onLayoutChange} />)
    fireEvent.click(screen.getByText('Auto-ajustar'))
    expect(onLayoutChange).toHaveBeenCalled()
    const lastLayout = onLayoutChange.mock.calls.at(-1)?.[0]
    expect(lastLayout).toHaveProperty('a')
    expect(lastLayout).toHaveProperty('b')
  })

  it('start drag (mousedown header) + move + mouseup persists layout', () => {
    const onLayoutChange = vi.fn()
    // jsdom devuelve clientWidth=0 por defecto; lo forzamos para que el componente NO entre en modo mobile.
    const widthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    const heightDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return 1400 } })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return 800 } })
    try {
      render(<PanelWorkspace panels={makePanels()} onLayoutChange={onLayoutChange} />)
      const header = screen.getByText('Panel A').closest('header')!

      fireEvent.mouseDown(header, { clientX: 0, clientY: 0 })
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 40 }))
        window.dispatchEvent(new MouseEvent('mouseup'))
      })
      expect(onLayoutChange).toHaveBeenCalled()
    } finally {
      if (widthDesc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', widthDesc)
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
      if (heightDesc) Object.defineProperty(HTMLElement.prototype, 'clientHeight', heightDesc)
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight
    }
  })

  it('switches to mobile mode below breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true, writable: true })
    render(<PanelWorkspace panels={makePanels()} />)
    expect(screen.getByText(/Vista compacta activa/)).toBeInTheDocument()
  })
})
