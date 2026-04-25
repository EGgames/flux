import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AudioEffectsPage from '@renderer/pages/AudioEffectsPage/AudioEffectsPage'

vi.mock('@renderer/components/MixerDJ/MixerDJ', () => ({
  default: () => <div data-testid="mixer-dj-mock">MixerMock</div>
}))

const profile = {
  id: 'p1',
  name: 'Mi Perfil',
  preferences: '{}',
  createdAt: '',
  updatedAt: ''
}

beforeEach(() => {
  Object.defineProperty(window, 'electronAPI', {
    value: {
      audioEffects: {
        get: vi.fn().mockResolvedValue({
          id: 'cfg1',
          profileId: 'p1',
          crossfadeEnabled: true,
          crossfadeMs: 3000,
          crossfadeCurve: 'equal-power',
          createdAt: '',
          updatedAt: ''
        }),
        update: vi.fn().mockImplementation((p) => Promise.resolve({ ...p, id: 'cfg1' }))
      },
      audioAssets: {
        list: vi.fn().mockResolvedValue([
          { id: 'a1', name: 'Tema A', sourceType: 'local', sourcePath: 'a.mp3', durationMs: 1000, tags: '[]', fadeInMs: null, fadeOutMs: null, createdAt: '', updatedAt: '' },
          { id: 'a2', name: 'Tema B', sourceType: 'local', sourcePath: 'b.mp3', durationMs: 1000, tags: '[]', fadeInMs: 500, fadeOutMs: 1500, createdAt: '', updatedAt: '' }
        ]),
        updateFades: vi.fn().mockImplementation((id, fi, fo) =>
          Promise.resolve({ id, name: 'Tema', sourceType: 'local', sourcePath: 'x.mp3', durationMs: 1000, tags: '[]', fadeInMs: fi, fadeOutMs: fo, createdAt: '', updatedAt: '' })
        )
      }
    },
    writable: true,
    configurable: true
  })
})

describe('AudioEffectsPage', () => {
  it('muestra mensaje cuando no hay perfil activo', () => {
    render(<AudioEffectsPage activeProfile={null} />)
    expect(screen.getByText(/Seleccion[áa] un Perfil/i)).toBeInTheDocument()
  })

  it('renderiza las 3 tabs', () => {
    render(<AudioEffectsPage activeProfile={profile} />)
    expect(screen.getByRole('tab', { name: /Global/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Por tema/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Mixer DJ/i })).toBeInTheDocument()
  })

  it('Tab Global carga config y guarda cambios', async () => {
    render(<AudioEffectsPage activeProfile={profile} />)
    await waitFor(() => expect(window.electronAPI.audioEffects.get).toHaveBeenCalledWith('p1'))
    const checkbox = await screen.findByRole('checkbox', { name: /Habilitar/i })
    expect((checkbox as HTMLInputElement).checked).toBe(true)
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByText(/^Guardar$/i))
    await waitFor(() => expect(window.electronAPI.audioEffects.update).toHaveBeenCalled())
    const callArg = vi.mocked(window.electronAPI.audioEffects.update).mock.calls[0][0]
    expect(callArg.crossfadeEnabled).toBe(false)
  })

  it('Tab Por tema lista assets y guarda fades', async () => {
    render(<AudioEffectsPage activeProfile={profile} />)
    fireEvent.click(screen.getByRole('tab', { name: /Por tema/i }))
    await waitFor(() => expect(window.electronAPI.audioAssets.list).toHaveBeenCalled())
    expect(await screen.findByText('Tema A')).toBeInTheDocument()
    expect(await screen.findByText('Tema B')).toBeInTheDocument()
    const fadeInB = screen.getByLabelText(/Fade in Tema B/i)
    fireEvent.change(fadeInB, { target: { value: '2000' } })
    const saveButtons = screen.getAllByText(/^Guardar$/i)
    fireEvent.click(saveButtons[1])
    await waitFor(() => expect(window.electronAPI.audioAssets.updateFades).toHaveBeenCalled())
    const args = vi.mocked(window.electronAPI.audioAssets.updateFades).mock.calls[0]
    expect(args[0]).toBe('a2')
    expect(args[1]).toBe(2000)
  })

  it('Tab Mixer monta el componente MixerDJ', () => {
    render(<AudioEffectsPage activeProfile={profile} />)
    fireEvent.click(screen.getByRole('tab', { name: /Mixer DJ/i }))
    expect(screen.getByTestId('mixer-dj-mock')).toBeInTheDocument()
  })
})
