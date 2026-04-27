import { Component, type ReactNode, type ErrorInfo } from 'react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
  /** Optional override del fallback. Si no se pasa, usa el panel default. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Hook para reportar al main process / telemetria. */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.props.onError) {
      try { this.props.onError(error, info) } catch { /* no-op */ }
      return
    }
    // Reportar via IPC (definido en preload). Best-effort.
    try {
      const api = (window as unknown as { electronAPI?: { app?: { log?: (p: unknown) => unknown } } }).electronAPI
      api?.app?.log?.({ level: 'error', message: error.message, context: { stack: error.stack, componentStack: info.componentStack } })
    } catch { /* no-op */ }
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  reload = (): void => {
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload()
    }
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)
    return (
      <div className={styles.root} role="alert" data-testid="error-boundary-fallback">
        <div className={styles.panel}>
          <h2>Algo salio mal</h2>
          <p className={styles.msg}>{error.message}</p>
          <pre className={styles.stack}>{error.stack}</pre>
          <div className={styles.actions}>
            <button type="button" onClick={this.reset}>Reintentar</button>
            <button type="button" onClick={this.reload}>Reiniciar app</button>
          </div>
        </div>
      </div>
    )
  }
}
