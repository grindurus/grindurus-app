import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Keeps the shell alive when a wallet/network switch throws during render
 * (e.g. stale 0x mint passed to PublicKey). Without this the React root unmounts
 * and the user only sees a black screen.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary caught', error, info.componentStack)
  }

  private handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeContent: 'center',
            gap: '1rem',
            padding: '2rem',
            textAlign: 'center',
            background: 'var(--bg, #0a0a0a)',
            color: 'var(--fg, #f5f5f5)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Something went wrong</p>
          <p style={{ margin: 0, maxWidth: '28rem', opacity: 0.75, fontSize: '0.875rem' }}>
            A network or wallet update hit an unexpected error. Reload to continue.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              justifySelf: 'center',
              padding: '0.55rem 1.25rem',
              borderRadius: '0.5rem',
              border: '1px solid currentColor',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
