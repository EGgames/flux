import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Layout from '@renderer/components/Layout/Layout'

vi.mock('@renderer/components/Sidebar/Sidebar', () => ({
  default: () => <div data-testid="sidebar-mock">sidebar</div>
}))

vi.mock('@renderer/components/NowPlayingBar/NowPlayingBar', () => ({
  default: () => <div data-testid="nowplaying-mock">nowplaying</div>
}))

describe('Layout', () => {
  it('renders shell with children and delegated components', () => {
    render(
      <Layout
        activeProfile={null}
        playoutStatus={{ state: 'stopped', profileId: null, track: null, queueIndex: 0, queueLength: 0, songsSinceLastAd: 0 }}
        playoutControls={{ pause: vi.fn(), resume: vi.fn(), prev: vi.fn(), next: vi.fn(), stop: vi.fn(), volume: 1, setVolume: vi.fn() }}
      >
        <div>content body</div>
      </Layout>
    )

    expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument()
    expect(screen.getByTestId('nowplaying-mock')).toBeInTheDocument()
    expect(screen.getByText('content body')).toBeInTheDocument()
  })
})
