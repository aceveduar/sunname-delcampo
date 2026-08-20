import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'

export type ReceiptLine = { name: string; detail: string; total: number }

export type ReceiptData = {
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
}: {
  receipt: ReceiptData | null
  onClose: () => void
}) {
  if (!receipt) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Venta registrada</DialogTitle>
        </DialogHeader>

        <div id="receipt-print-area" className="flex flex-col gap-3 text-sm">
          <div className="text-center">
            <p className="text-base font-semibold">Del Campo</p>
            <p className="text-muted-foreground text-xs">
              {formatDateTime(receipt.createdAt)} · Folio {receipt.saleId.slice(0, 8)}
            </p>
            {receipt.customerName && <p className="text-muted-foreground text-xs">Cliente: {receipt.customerName}</p>}
          </div>

          <div className="flex flex-col gap-1 border-y border-dashed border-border py-2">
            {receipt.lines.map((line, index) => (
              <div key={index} className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate">{line.name}</p>
                  <p className="text-muted-foreground text-xs">{line.detail}</p>
                </div>
                <span className="shrink-0 font-medium">{formatCurrency(line.total)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(receipt.total)}</span>
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

          <p className="text-muted-foreground text-center text-xs">Gracias por su compra</p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Nueva venta
          </Button>
          <Button onClick={() => window.print()}>Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
