import { useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoadError } from '@/components/LoadError'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { useAsyncAction } from '@/lib/useAsyncAction'
import { formatCurrency } from '@/lib/currency'
import {
  loadBillableSession,
  requestBillingInvoice,
  billingDate,
  type BillableSession,
} from './billingData'
import { BillingStatus } from './BillingStatus'

export function BillingSessionDialog({
  sessionId,
  canRequest,
  onClose,
  onChanged,
}: {
  sessionId: string
  canRequest: boolean
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const fetcher = useCallback(
    async () => ({ data: await loadBillableSession(sessionId), error: null }),
    [sessionId],
  )
  const { data, setData, loading, error, refresh } =
    useAsyncResource<BillableSession | null>(
      fetcher,
      'No se pudo consultar el detalle del corte',
      null,
    )
  const action = useAsyncAction(
    'No se pudo confirmar la solicitud. Actualiza el detalle para comprobar su estado antes de reintentar.',
  )
  const submit = () => {
    if (
      !data ||
      loading ||
      error ||
      data.invoice ||
      !canRequest ||
      data.salesTotal <= 0
    )
      return
    void action.run(async () => {
      const invoice = await requestBillingInvoice(sessionId)
      setData((previous) => (previous ? { ...previous, invoice } : previous))
      toast.success('Solicitud registrada', {
        description: `Total: ${formatCurrency(invoice.total)}`,
      })
      await onChanged()
      return true
    })
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !action.pendingRef.current) onClose()
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={!action.pending}
      >
        <DialogHeader className="shrink-0 border-b p-4 pr-12">
          <DialogTitle>Detalle del corte</DialogTitle>
          <DialogDescription>Corte {sessionId.slice(0, 8)}</DialogDescription>
        </DialogHeader>
        <div
          className="min-h-0 space-y-4 overflow-y-auto p-4"
          aria-busy={loading || action.pending}
        >
          <LoadError message={error} onRetry={refresh} loading={loading} />
          {loading && (
            <p role="status" className="text-muted-foreground text-sm">
              Consultando importes y solicitud…
            </p>
          )}
          {data && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{billingDate(data.closedAt)}</p>
                  <p className="text-muted-foreground text-sm wrap-anywhere">
                    Cerrado por {data.closedBy}
                  </p>
                </div>
                <BillingStatus invoice={data.invoice} />
              </div>
              <dl className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt>Efectivo contado</dt>
                  <dd className="tabular-nums">
                    {data.cashCounted === null
                      ? 'No registrado'
                      : formatCurrency(data.cashCounted)}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt>
                    Ventas del corte{' '}
                    <span className="text-muted-foreground text-xs">
                      ({data.saleCount})
                    </span>
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatCurrency(data.salesTotal)}
                  </dd>
                </div>
                {data.invoice && (
                  <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
                    <dt>Total de la solicitud</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {formatCurrency(data.invoice.total)}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="text-muted-foreground text-xs">
                Las ventas incluyen todos los métodos de pago y excluyen
                anulaciones. El efectivo contado puede incluir el fondo inicial
                y movimientos de caja.
              </p>
              {data.invoice ? (
                <div className="space-y-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Solicitada:</span>{' '}
                    {billingDate(data.invoice.requested_at)}
                  </p>
                  {data.invoice.uuid_fiscal && (
                    <p className="break-all">
                      <span className="text-muted-foreground">
                        UUID fiscal:
                      </span>{' '}
                      {data.invoice.uuid_fiscal}
                    </p>
                  )}
                  {data.invoice.status === 'error' && (
                    <div
                      role="alert"
                      className="border-destructive/30 bg-destructive/5 space-y-1 rounded-lg border p-3"
                    >
                      <p className="font-medium">La solicitud tiene un error</p>
                      <p className="wrap-anywhere">
                        {data.invoice.error_message ||
                          'No hay más información registrada. Consulta con el administrador.'}
                      </p>
                    </div>
                  )}
                  {data.invoice.status === 'pending' && (
                    <p className="bg-muted/50 rounded-lg p-3">
                      La solicitud está guardada, pendiente de timbrado. Todavía
                      no es una factura timbrada.
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-muted/50 space-y-2 rounded-lg p-3 text-sm">
                  <p>
                    {data.salesTotal > 0
                      ? 'La solicitud tomará el total de las ventas completadas vigente al registrarse.'
                      : 'Este corte no tiene ventas completadas que solicitar.'}
                  </p>
                  <p>
                    El timbrado con un PAC todavía no está conectado. La
                    solicitud quedará pendiente.
                  </p>
                  {!canRequest && (
                    <p>
                      Completa o vuelve a cargar los datos fiscales del negocio
                      para continuar.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          {action.error && (
            <p role="alert" className="text-destructive text-sm">
              {action.error}
            </p>
          )}
        </div>
        <DialogFooter className="m-0 shrink-0 rounded-none">
          <Button variant="ghost" disabled={action.pending} onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="outline"
            disabled={loading || action.pending}
            onClick={() => {
              action.clearError()
              void refresh()
            }}
          >
            Actualizar detalle
          </Button>
          {data && !data.invoice && (
            <Button
              disabled={
                loading ||
                !!error ||
                action.pending ||
                !canRequest ||
                data.salesTotal <= 0
              }
              onClick={submit}
            >
              {action.pending ? 'Registrando…' : 'Registrar solicitud'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
