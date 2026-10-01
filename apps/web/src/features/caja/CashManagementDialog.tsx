import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CashSessionSummary } from './CashSessionSummary'
import { useCashMovement } from './useCashMovement'

export function CashManagementDialog({
  sessionId,
  userId,
  revision,
  onPendingChange,
}: {
  sessionId: string
  userId: string
  revision: number
  onPendingChange: (pending: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  // Persiste aun con el diálogo cerrado: nunca habilitar cierre de caja
  // mientras haya un movimiento cuyo resultado no se ha confirmado.
  const movement = useCashMovement(sessionId, userId)
  const pending = !!movement.pending || movement.busy || movement.blocked
  useEffect(() => {
    onPendingChange(pending)
  }, [pending, onPendingChange])
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!movement.busy) setOpen(next)
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Administrar efectivo{pending ? ' · Pendiente' : ''}
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
        showCloseButton={!movement.busy}
      >
        <DialogHeader>
          <DialogTitle>Efectivo y movimientos de caja</DialogTitle>
          <DialogDescription>
            Consulta el saldo esperado y registra entradas o salidas de
            efectivo.
          </DialogDescription>
        </DialogHeader>
        <CashSessionSummary
          sessionId={sessionId}
          revision={revision}
          movement={movement}
        />
      </DialogContent>
    </Dialog>
  )
}
