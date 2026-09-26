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
    <ModuleErrorBoundary>
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
