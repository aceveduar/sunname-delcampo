import type { RefObject } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import { useTenantSettings } from '@/features/settings/useTenantSettings'

export type ReceiptLine = { name: string; detail: string; total: number }

export type ReceiptData = {
  status?: 'completed' | 'voided'
  saleId: string
  createdAt: string
  lines: ReceiptLine[]
  total: number
  paymentMethodName: string
  cashReceived: number | null
  change: number | null
  customerName: string | null
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ReceiptDialog({
  receipt,
  onClose,
  copy = false,
  returnFocus,
}: {
  receipt: ReceiptData | null
  returnFocus?: RefObject<HTMLElement | null>
  copy?: boolean
  onClose: () => void
}) {
  const { businessName } = useTenantSettings()

  if (!receipt) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        finalFocus={returnFocus}
        className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-sm print:max-h-none print:overflow-visible"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {copy ? 'Copia de ticket' : 'Venta registrada'}
          </DialogTitle>
        </DialogHeader>

        {!copy && receipt.status !== 'voided' && (
          <div className="bg-muted/60 shrink-0 rounded-lg p-3 print:hidden">
            <p className="text-sm">
              {receipt.change !== null ? 'Entregar de cambio' : 'Total pagado'}
            </p>
            <p className="text-foreground text-3xl font-semibold tabular-nums">
              {formatCurrency(receipt.change ?? receipt.total)}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Total: {formatCurrency(receipt.total)}
              {receipt.cashReceived !== null
                ? ' · Recibido: ' + formatCurrency(receipt.cashReceived)
                : ' · ' + receipt.paymentMethodName}
            </p>
          </div>
        )}
        <div className="min-h-0 overflow-y-auto overscroll-contain print:overflow-visible">
          <div data-print-area className="flex flex-col gap-3 text-sm">
            <div className="text-center">
              {copy && <p className="font-semibold">COPIA DE TICKET</p>}
              {receipt.status === 'voided' && (
                <p className="font-bold">VENTA ANULADA</p>
              )}
              <p className="text-base font-semibold">{businessName}</p>
              <p className="text-muted-foreground text-xs">
                {formatDateTime(receipt.createdAt)} · Folio{' '}
                {receipt.saleId.slice(0, 8)}
              </p>
              {receipt.customerName && (
                <p className="text-muted-foreground text-xs">
                  Cliente: {receipt.customerName}
                </p>
              )}
            </div>

            <div className="border-border flex flex-col gap-1 border-y border-dashed py-2">
              {receipt.lines.map((line, index) => (
                <div
                  key={index}
                  className="flex items-baseline justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="wrap-break-word">{line.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {line.detail}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium">
                    {formatCurrency(line.total)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <span className="text-foreground">
                {formatCurrency(receipt.total)}
              </span>
            </div>

            <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
              <div className="flex justify-between">
                <span>Método de pago</span>
                <span>{receipt.paymentMethodName}</span>
              </div>
              {receipt.cashReceived !== null && (
                <div className="flex justify-between">
                  <span>Efectivo recibido</span>
                  <span>{formatCurrency(receipt.cashReceived)}</span>
                </div>
              )}
              {receipt.change !== null && receipt.change > 0 && (
                <div className="flex justify-between">
                  <span>Cambio</span>
                  <span>{formatCurrency(receipt.change)}</span>
                </div>
              )}
            </div>

            <p className="text-muted-foreground text-center text-xs">
              Gracias por su compra
            </p>
          </div>
        </div>
        <DialogFooter className="shrink-0 gap-2 sm:justify-between print:hidden">
          <Button variant={copy ? 'outline' : 'default'} onClick={onClose}>
            {copy ? 'Volver' : 'Nueva venta'}
          </Button>
          <Button
            variant={copy ? 'default' : 'outline'}
            onClick={() => window.print()}
          >
            Imprimir ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
