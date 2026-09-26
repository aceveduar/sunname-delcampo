import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LoadError } from '@/components/LoadError'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { formatCurrency } from '@/lib/currency'
import {
  cashDifference,
  fetchCashBalance,
  type CashBalance,
} from './cashBalance'

export function CloseSessionDialog({
  sessionId,
  disabled = false,
  onClose,
}: {
  sessionId: string
  disabled?: boolean
  onClose: (
    closingAmount: number,
    notes: string | null,
    expectedAmount: number,
  ) => Promise<boolean>
}) {
  const online = useOnlineStatus()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [balance, setBalance] = useState<CashBalance | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const amount = Number(counted)
  const valid = counted.trim() !== '' && Number.isFinite(amount) && amount >= 0
  const difference =
    balance && valid
      ? cashDifference(amount, balance.expectedAmount) / 100
      : null
  const loadBalance = async () => {
    setBusy(true)
    setError(null)
    try {
      setBalance(await fetchCashBalance(sessionId))
    } catch {
      setError(
        'No se pudo consultar el efectivo esperado. Reintenta antes de cerrar.',
      )
    } finally {
      setBusy(false)
    }
  }
  const handleOpenChange = (next: boolean) => {
    if (busy || busyRef.current || disabled) return
    setOpen(next)
    if (next) {
      setCounted('')
      setNotes('')
      setBalance(null)
      void loadBalance()
    }
  }
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      busy ||
      busyRef.current ||
      !online ||
      !valid ||
      !balance ||
      error ||
      (difference !== 0 && !notes.trim())
    )
      return
    busyRef.current = true
    setBusy(true)
    try {
      const latest = await fetchCashBalance(sessionId)
      if (cashDifference(latest.expectedAmount, balance.expectedAmount) !== 0) {
        setBalance(latest)
        setError(
          'El efectivo esperado cambió. Actualiza el resumen y revisa la diferencia antes de confirmar.',
        )
        return
      }
      if (await onClose(amount, notes.trim() || null, latest.expectedAmount))
        setOpen(false)
    } catch {
      setError(
        'No se pudo confirmar el cierre. Revisa el estado de caja antes de reintentar.',
      )
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        disabled={disabled}
        render={<Button variant="outline" size="sm" />}
      >
        Cerrar caja
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
          <DialogDescription>
            Cuenta el efectivo y revisa el resumen antes de confirmar.
          </DialogDescription>
        </DialogHeader>
        <LoadError message={error} onRetry={loadBalance} loading={busy} />
        {busy && !balance && <p role="status">Consultando caja…</p>}
        {balance && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>Fondo inicial</dt>
            <dd className="text-right">
              {formatCurrency(balance.openingAmount)}
            </dd>
            <dt>Ventas en efectivo</dt>
            <dd className="text-right">{formatCurrency(balance.cashSales)}</dd>
            <dt>Entradas de efectivo</dt>
            <dd className="text-right">{formatCurrency(balance.cashIn)}</dd>
            <dt>Salidas de efectivo</dt>
            <dd className="text-right">{formatCurrency(balance.cashOut)}</dd>
            <dt className="font-semibold">Efectivo esperado</dt>
            <dd className="text-right font-semibold">
              {formatCurrency(balance.expectedAmount)}
            </dd>
          </dl>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="closing_amount">Efectivo contado</Label>
            <Input
              id="closing_amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              value={counted}
              disabled={busy}
              onChange={(event) => setCounted(event.target.value)}
            />
          </div>
          <p role="status" className="bg-muted rounded-md p-3 text-sm">
            {difference === null
              ? 'Ingresa el efectivo contado para ver la diferencia.'
              : difference === 0
                ? 'La caja cuadra.'
                : difference < 0
                  ? 'Faltan ' + formatCurrency(-difference)
                  : 'Sobran ' + formatCurrency(difference)}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="closing-notes">
              {difference !== null && difference !== 0
                ? 'Observación del descuadre (obligatoria)'
                : 'Observación (opcional)'}
            </Label>
            <Textarea
              id="closing-notes"
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={busy}
              required={difference !== null && difference !== 0}
            />
          </div>
          {!online && (
            <p role="status">Necesitas conexión para cerrar la caja.</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Seguir en caja
            </Button>
            <Button
              type="submit"
              disabled={
                busy ||
                !online ||
                !valid ||
                !balance ||
                !!error ||
                (difference !== 0 && !notes.trim())
              }
            >
              {busy ? 'Verificando…' : 'Confirmar cierre'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
