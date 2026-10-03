import { lazy, Suspense } from 'react'
import { ModuleErrorBoundary } from './ModuleErrorBoundary'
const Scanner = lazy(() =>
  import('./BarcodeScannerContent').then((module) => ({
    default: module.BarcodeScannerContent,
  })),
)

export function BarcodeScannerDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDetected: (code: string) => void
}) {
  if (!props.open) return null
  return (
    <ModuleErrorBoundary
      fallback={(retry) => (
        <section role="alert" className="space-y-2 rounded-lg border p-3">
          <p>
            No se pudo abrir el lector. Puedes cerrarlo y escribir el código en
            el buscador.
          </p>
          <div className="flex gap-3">
            <button type="button" className="underline" onClick={retry}>
              Reintentar
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => props.onOpenChange(false)}
            >
              Cerrar lector
            </button>
          </div>
        </section>
      )}
    >
      <Suspense
        fallback={
          <p role="status">
            Cargando lector…{' '}
            <button
              type="button"
              className="underline"
              onClick={() => props.onOpenChange(false)}
            >
              Cancelar
            </button>
          </p>
        }
      >
        <Scanner {...props} />
      </Suspense>
    </ModuleErrorBoundary>
  )
}
