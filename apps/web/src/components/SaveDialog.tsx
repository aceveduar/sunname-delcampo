import { useEffect, useState, type ReactNode } from 'react'
import { useAsyncAction } from '@/lib/useAsyncAction'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { ConfirmDialog } from './ConfirmDialog'

/** Formulario montado por apertura: conserva la captura ante errores y protege su cierre. */
export function SaveDialog({
  title,
  description,
  dirty,
  onSave,
  onClose,
  children,
  saveLabel = 'Guardar cambios',
  savingLabel = 'Guardando…',
}: {
  title: string
  description?: string
  dirty: boolean
  onSave: () => Promise<boolean>
  onClose: () => void
  children: (saving: boolean) => ReactNode
  saveLabel?: string
  savingLabel?: string
}) {
  const action = useAsyncAction(
    'No se pudo completar la operación. Tu captura sigue aquí para reintentar.',
  )
  const [discard, setDiscard] = useState(false)
  const close = () => {
    if (action.pendingRef.current) return
    if (dirty) setDiscard(true)
    else onClose()
  }
  useEffect(() => {
    if (!dirty && !action.pending) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty, action.pending])
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
        showCloseButton={!action.pending}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          aria-busy={action.pending}
          className="min-w-0 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (await action.run(onSave)) onClose()
          }}
        >
          <fieldset disabled={action.pending} className="min-w-0 space-y-4">
            {children(action.pending)}
          </fieldset>
          {action.error && (
            <p role="alert" className="text-destructive text-sm">
              {action.error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={action.pending}
              onClick={close}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={action.pending}>
              {action.pending ? savingLabel : saveLabel}
            </Button>
          </DialogFooter>
        </form>
        <ConfirmDialog
          open={discard}
          onOpenChange={setDiscard}
          title="¿Descartar cambios?"
          description="Los cambios sin guardar se perderán. Cancela para seguir editando."
          confirmLabel="Descartar cambios"
          variant="destructive"
          onConfirm={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
