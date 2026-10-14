import { lazy, Suspense, useState } from 'react'
import { ModuleErrorBoundary } from '@/components/ModuleErrorBoundary'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Product } from './useProducts'

type Props = {
  product: Product | null
  onOpenChange: (open: boolean) => void
  onAssignSku: (id: string, sku: string) => Promise<boolean>
}

const loadContent = () =>
  lazy(() =>
    import('./LabelPrintContent').then((module) => ({
      default: module.LabelPrintContent,
    })),
  )

/** Solo descarga el generador cuando se solicita una etiqueta. */
export function LabelPrintDialog(props: Props) {
  const [Content, setContent] = useState(loadContent)
  if (!props.product) return null

  const placeholder = (retry?: () => void) => (
    <Dialog open onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Imprimir etiqueta</DialogTitle>
        </DialogHeader>
        <p role={retry ? 'alert' : 'status'}>
          {retry
            ? 'No se pudo cargar la herramienta de etiquetas. Intenta nuevamente.'
            : 'Cargando etiqueta…'}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancelar
          </Button>
          {retry && <Button onClick={retry}>Reintentar</Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
  return (
    <ModuleErrorBoundary
      fallback={(retry) =>
        placeholder(() => {
          setContent(loadContent)
          retry()
        })
      }
    >
      <Suspense fallback={placeholder()}>
        <Content {...props} />
      </Suspense>
    </ModuleErrorBoundary>
  )
}
