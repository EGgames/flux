import { useEffect, useState } from 'react'

export interface StallEvent {
  trackId: string
  reason: string
  at: number
}

interface ElectronAPI {
  on?: (channel: string, callback: (...args: unknown[]) => void) => void
  off?: (channel: string, callback: (...args: unknown[]) => void) => void
}

/**
 * Toast no bloqueante para eventos `playout:stall` emitidos por el watchdog.
 * Se auto-cierra a los 6 segundos.
 */
export default function StallToast(): JSX.Element | null {
  const [event, setEvent] = useState<StallEvent | null>(null)

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
    if (!api?.on) return
    const handler = (...args: unknown[]): void => {
      const p = args[0] as { trackId?: string; reason?: string } | undefined
      if (!p?.trackId) return
      setEvent({ trackId: p.trackId, reason: p.reason ?? 'no_progress', at: Date.now() })
      setTimeout(() => setEvent(null), 6000)
    }
    api.on('playout:stall', handler)
    return () => { api.off?.('playout:stall', handler) }
  }, [])

  if (!event) return null
  return (
    <div
      role="status"
      data-testid="stall-toast"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: '#7c2d12',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 6,
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        fontWeight: 600
      }}
    >
      Track sin progreso detectado: {event.reason}. Saltando al siguiente...
    </div>
  )
}
