import { Component, type ReactNode, type ErrorInfo } from 'react'
import { reportError } from '@/lib/errors'
import { Button } from '@/components/ui/button'

export class ModuleErrorBoundary extends Component<
  { children: ReactNode; fallback?: (retry: () => void) => ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError('No se pudo abrir el módulo', error, {
      componentStack: info.componentStack,
    })
  }
  retry = () => this.setState({ failed: false })
  render() {
    if (!this.state.failed) return this.props.children
    return (
      this.props.fallback?.(this.retry) ?? (
        <section role="alert" className="space-y-3 rounded-lg border p-4">
          <p>
            No se pudo abrir esta pantalla. Revisa tu conexión e intenta de
            nuevo.
          </p>
          <Button onClick={this.retry}>Reintentar</Button>
        </section>
      )
    )
  }
}
