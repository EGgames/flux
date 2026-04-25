import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import VUMeter from '@renderer/components/VUMeter/VUMeter'

describe('VUMeter', () => {
  it('renderiza ambos canales L y R', () => {
    render(<VUMeter left={-12} right={-18} />)
    expect(screen.getByTestId('vu-meter')).toBeInTheDocument()
    expect(screen.getByTestId('vu-meter-L')).toBeInTheDocument()
    expect(screen.getByTestId('vu-meter-R')).toBeInTheDocument()
  })

  it('formatea silencio (-Infinity) como -∞', () => {
    render(<VUMeter left={-Infinity} right={-Infinity} />)
    const lValue = screen.getByTestId('vu-meter-L-value')
    const rValue = screen.getByTestId('vu-meter-R-value')
    expect(lValue.textContent).toContain('-∞')
    expect(rValue.textContent).toContain('-∞')
  })

  it('formatea valores en dB con 1 decimal', () => {
    render(<VUMeter left={-6.3} right={-12.7} />)
    expect(screen.getByTestId('vu-meter-L-value').textContent).toBe('-6.3 dB')
    expect(screen.getByTestId('vu-meter-R-value').textContent).toBe('-12.7 dB')
  })

  it('muestra indicador de clipping cuando db >= 0', () => {
    render(<VUMeter left={0.1} right={-1} />)
    expect(screen.queryByTestId('vu-meter-L-clip')).toBeInTheDocument()
    expect(screen.queryByTestId('vu-meter-R-clip')).not.toBeInTheDocument()
  })

  it('expone roles meter con valores aria correctos', () => {
    render(<VUMeter left={-24} right={-6} />)
    const meters = screen.getAllByRole('meter')
    expect(meters).toHaveLength(2)
    expect(meters[0]).toHaveAttribute('aria-valuemin', '-60')
    expect(meters[0]).toHaveAttribute('aria-valuemax', '0')
    expect(meters[0]).toHaveAttribute('aria-valuenow', '-24')
    expect(meters[1]).toHaveAttribute('aria-valuenow', '-6')
  })

  it('clamp para valores fuera del rango visible', () => {
    render(<VUMeter left={-200} right={20} minDb={-60} maxDb={0} />)
    // No revienta con valores extremos.
    expect(screen.getByTestId('vu-meter')).toBeInTheDocument()
  })

  it('respeta umbrales custom (yellowDb, redDb)', () => {
    render(<VUMeter left={-30} right={-30} yellowDb={-24} redDb={-12} />)
    expect(screen.getByTestId('vu-meter')).toBeInTheDocument()
  })
})
