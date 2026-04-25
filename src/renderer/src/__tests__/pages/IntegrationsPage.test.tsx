import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listMock = vi.fn()
const saveMock = vi.fn()
const testMock = vi.fn()
const toggleEnabledMock = vi.fn()

vi.mock('@renderer/services/outputService', () => ({
  outputService: {
    list: (...args: unknown[]) => listMock(...args),
    save: (...args: unknown[]) => saveMock(...args),
    test: (...args: unknown[]) => testMock(...args),
    toggleEnabled: (...args: unknown[]) => toggleEnabledMock(...args)
  }
}))

import IntegrationsPage from '@renderer/pages/IntegrationsPage/IntegrationsPage'

describe('IntegrationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    listMock.mockResolvedValue([
      { id: 'local-1', profileId: 'p1', outputType: 'local', config: '{"deviceId":"dev1","deviceName":"Speakers"}', enabled: true },
      { id: 'monitor-1', profileId: 'p1', outputType: 'monitor', config: '{"deviceId":"dev1","deviceName":"Speakers"}', enabled: false },
      { id: 'ice-1', profileId: 'p1', outputType: 'icecast', config: '{"host":"localhost","port":"8000","mountpoint":"/stream","username":"source","password":"x"}', enabled: true },
      { id: 'sh-1', profileId: 'p1', outputType: 'shoutcast', config: 'invalid-json', enabled: false }
    ])
    saveMock.mockImplementation(async (payload) => ({ id: `${payload.outputType}-saved`, ...payload }))
    testMock.mockResolvedValue({ success: true, message: 'OK' })
    toggleEnabledMock.mockImplementation(async (id, enabled) => ({ id, profileId: 'p1', outputType: 'local', config: '{}', enabled }))

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'audiooutput', deviceId: 'dev1', label: 'Speakers' },
          { kind: 'audioinput', deviceId: 'mic1', label: 'Mic' }
        ])
      }
    })
  })

  it('renders the title', () => {
    render(<IntegrationsPage profileId="p1" />)
    expect(screen.getByText('Salidas de Audio')).toBeInTheDocument()
  })

  it('calls outputService.list with profileId on mount', async () => {
    render(<IntegrationsPage profileId="p1" />)
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith('p1')
    )
  })

  it('does not call outputService.list when profileId is null', async () => {
    listMock.mockClear()
    render(<IntegrationsPage profileId={null} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(listMock).not.toHaveBeenCalled()
  })

  it('guarda local/monitor/icecast/shoutcast y permite toggles', async () => {
    render(<IntegrationsPage profileId="p1" />)

    await waitFor(() => expect(screen.getByText('Tarjeta de sonido (local)')).toBeInTheDocument())

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'dev1' } })
    fireEvent.click(screen.getAllByText('Guardar')[0])
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ outputType: 'local' })))

    fireEvent.click(screen.getAllByText('Guardar')[1])
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ outputType: 'monitor' })))

    const hostInputs = screen.getAllByPlaceholderText('localhost')
    fireEvent.change(hostInputs[0], { target: { value: 'ice.example.com' } })
    fireEvent.click(screen.getAllByText('Guardar')[2])
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ outputType: 'icecast' })))

    fireEvent.change(hostInputs[1], { target: { value: 'sh.example.com' } })
    fireEvent.click(screen.getAllByText('Guardar')[3])
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ outputType: 'shoutcast' })))

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    await waitFor(() => expect(toggleEnabledMock).toHaveBeenCalled())
  })

  it('ejecuta pruebas de conexión y muestra resultado', async () => {
    testMock.mockResolvedValueOnce({ success: true, message: 'Conectado' })
    testMock.mockResolvedValueOnce({ success: false, message: 'Falló' })

    render(<IntegrationsPage profileId="p1" />)
    await waitFor(() => expect(screen.getAllByText('Probar conexión').length).toBeGreaterThanOrEqual(2))

    const buttons = screen.getAllByText('Probar conexión')
    fireEvent.click(buttons[0])
    await waitFor(() => expect(screen.getByText('Conectado')).toBeInTheDocument())

    fireEvent.click(buttons[1])
    await waitFor(() => expect(screen.getByText('Falló')).toBeInTheDocument())
  })

  it('usa fallback de dispositivos cuando enumerateDevices falla', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { enumerateDevices: vi.fn().mockRejectedValue(new Error('no devices')) }
    })

    render(<IntegrationsPage profileId="p1" />)
    await waitFor(() => expect(screen.getByText('Tarjeta de sonido (local)')).toBeInTheDocument())
    expect(screen.getAllByDisplayValue('Salida del sistema (default)').length).toBeGreaterThan(0)
  })
})
