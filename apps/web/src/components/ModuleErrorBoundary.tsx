import { Component, type ReactNode, type ErrorInfo } from 'react'
import { reportError } from '@/lib/errors'
import { Button } from '@/components/ui/button'

/** Un módulo que no pudo descargarse no debe dejar toda la aplicación en blanco. */
export class ModuleErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError('No se pudo abrir el módulo', {
      error,
      componentStack: info.componentStack,
    })
  }
  render() {
    if (this.state.failed)
      return (
        <section role="alert" className="space-y-3 rounded-lg border p-4">
          <p>
            No se pudo abrir esta pantalla. Revisa tu conexión y vuelve a cargar
            la aplicación.
          </p>
          <Button onClick={() => window.location.reload()}>
            Volver a cargar
          </Button>
        </section>
      )
    return this.props.children
  }
}
