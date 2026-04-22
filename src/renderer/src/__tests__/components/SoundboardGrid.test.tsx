import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SoundboardGrid from '@renderer/components/SoundboardGrid/SoundboardGrid'

function button(slotIndex: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `b-${slotIndex}`,
    profileId: 'p1',
    slotIndex,
    label: 'Btn',
    audioAssetId: 'a1',
    audioAsset: {
      id: 'a1',
      name: 'Asset',
      sourceType: 'local',
      sourcePath: '/tmp/a.mp3',
      durationMs: null,
      tags: '{}',
      createdAt: '',
      updatedAt: ''
    },
    mode: 'oneshot',
    color: '#fff',
    ...overrides
  }
}

describe('SoundboardGrid', () => {
  it('calls assign when slot is empty', () => {
    const onTrigger = vi.fn()
    const onAssign = vi.fn()
    render(<SoundboardGrid buttons={[button(1, { audioAssetId: null, audioAsset: null })] as never} onTrigger={onTrigger} onAssign={onAssign} />)

    fireEvent.click(screen.getByTitle('Asignar audio'))

    expect(onAssign).toHaveBeenCalledWith(1)
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('calls trigger for assigned button and supports context assign', () => {
    const onTrigger = vi.fn()
    const onAssign = vi.fn()
    render(<SoundboardGrid buttons={[button(2)] as never} onTrigger={onTrigger} onAssign={onAssign} />)

    fireEvent.click(screen.getByTitle('Btn'))
    fireEvent.contextMenu(screen.getByTitle('Btn'))

    expect(onTrigger).toHaveBeenCalledWith(2)
    expect(onAssign).toHaveBeenCalledWith(2)
  })

  it('toggles active slot for toggle mode and keeps label fallback', () => {
    const onTrigger = vi.fn()
    render(<SoundboardGrid buttons={[button(3, { mode: 'toggle', label: null })] as never} onTrigger={onTrigger} />)

    fireEvent.click(screen.getByTitle('Asset'))
    fireEvent.click(screen.getByTitle('Asset'))

    expect(onTrigger).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Asset')).toBeInTheDocument()
  })

  it('renders dash fallback when label and audio name are missing', () => {
    render(
      <SoundboardGrid
        buttons={[button(4, { label: null, audioAssetId: 'a2', audioAsset: null })] as never}
        onTrigger={vi.fn()}
      />
    )

    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
