import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary'

function Boom({ shouldThrow }: { shouldThrow: boolean }): JSX.Element {
  if (shouldThrow) throw new Error('boom!')
  return <div>safe</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Silenciar React error logs en tests.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('safe')).toBeTruthy()
    expect(screen.queryByTestId('error-boundary-fallback')).toBeNull()
  })

  it('renders fallback panel on child error', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    )
    const panel = screen.getByTestId('error-boundary-fallback')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toMatch(/boom!/)
  })

  it('uses custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={(err) => <div data-testid="custom">{err.message}</div>}>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('custom').textContent).toBe('boom!')
  })

  it('calls onError when child throws', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(onError).toHaveBeenCalled()
  })

  it('reload button calls window.location.reload', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload }
    })
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    )
    fireEvent.click(screen.getByRole('button', { name: /reiniciar/i }))
    expect(reload).toHaveBeenCalled()
  })
})
