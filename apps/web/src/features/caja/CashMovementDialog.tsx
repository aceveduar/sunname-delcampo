import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { formatCurrency } from '@/lib/currency'
import type { useCashMovement, CashMovementInput } from './useCashMovement'

export function CashMovementDialog({
  movement,
  onSaved,
}: {
  movement: ReturnType<typeof useCashMovement>
  onSaved: () => void
}) {
  const online = useOnlineStatus()
  const [open, setOpen] = useState(false)
  const [direction, setDirection] =
    useState<CashMovementInput['direction']>('in')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const pending = movement.pending
  const value = pending?.amount ?? Number(amount)
  const valid =
    Number.isFinite(value) &&
    value > 0 &&
    value < 10000000000 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-6 &&
    !!(pending?.reason ?? reason).trim()
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || !online) return
    if (await movement.submit({ direction, amount: value, reason })) {
      setOpen(false)
      setAmount('')
      setReason('')
      onSaved()
    }
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {pending ? 'Verificar movimiento pendiente' : 'Entrada / salida'}
      </Button>
      {pending && (
        <p role="status" className="text-sm">
          Hay un movimiento pendiente de confirmación.
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!movement.busy) setOpen(next)
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          showCloseButton={!movement.busy}
        >
          <DialogHeader>
            <DialogTitle>Movimiento de efectivo</DialogTitle>
            <DialogDescription>
              Registra aportaciones, gastos o retiros. El motivo y responsable
              quedarán en el historial.
            </DialogDescription>
          </DialogHeader>
          {movement.error && (
            <p role="alert" className="text-destructive text-sm">
              {movement.error}
            </p>
          )}
          <form onSubmit={submit} className="space-y-4">
            <fieldset
              disabled={movement.busy || !!pending || movement.blocked}
              className="space-y-4"
            >
              <legend className="sr-only">Datos del movimiento</legend>
              <div className="space-y-1.5">
                <Label htmlFor="movement-direction">Tipo</Label>
                <select
                  id="movement-direction"
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={pending?.direction ?? direction}
                  onChange={(e) =>
                    setDirection(
                      e.target.value as CashMovementInput['direction'],
                    )
                  }
                >
                  <option value="in">Entrada de efectivo</option>
                  <option value="out">Salida de efectivo</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="movement-amount">Importe</Label>
                <Input
                  id="movement-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  required
                  value={pending?.amount ?? amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="movement-reason">Motivo</Label>
                <Textarea
                  id="movement-reason"
                  required
                  maxLength={500}
                  placeholder="Ej. compra de bolsas o retiro para depósito"
                  value={pending?.reason ?? reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </fieldset>
            {valid && (
              <p className="bg-muted rounded-md p-3 text-sm">
                {(pending?.direction ?? direction) === 'in'
                  ? 'Se sumarán '
                  : 'Se restarán '}
                {formatCurrency(value)} al efectivo esperado.
              </p>
            )}
            {!online && (
              <p role="status">
                Necesitas conexión para registrar el movimiento.
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={movement.busy}
                onClick={() => setOpen(false)}
              >
                Volver
              </Button>
              <Button
                type="submit"
                disabled={
                  !valid || !online || movement.busy || movement.blocked
                }
              >
                {movement.busy
                  ? 'Confirmando…'
                  : pending
                    ? 'Reintentar confirmación'
                    : 'Confirmar movimiento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
