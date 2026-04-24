import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@renderer/services/outputService', () => ({
  outputService: {
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
    test: vi.fn(),
    toggleEnabled: vi.fn()
  }
}))

import IntegrationsPage from '@renderer/pages/IntegrationsPage/IntegrationsPage'
import { outputService } from '@renderer/services/outputService'

describe('IntegrationsPage', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'audiooutput', deviceId: 'dev1', label: 'Speakers' }
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
      expect((outputService.list as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('p1')
    )
  })

  it('does not call outputService.list when profileId is null', async () => {
    ;(outputService.list as ReturnType<typeof vi.fn>).mockClear()
    render(<IntegrationsPage profileId={null} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(outputService.list).not.toHaveBeenCalled()
  })
})
