import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/currency'
import type { PurchaseOrder } from './usePurchaseOrders'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  ordered: 'Pendiente',
  received: 'Recibida',
  cancelled: 'Cancelada',
}

export function PurchaseOrderDetailDialog({
  order,
  onOpenChange,
}: {
  order: PurchaseOrder | null
  onOpenChange: (open: boolean) => void
}) {
  const total =
    order?.purchase_order_items.reduce((sum, item) => sum + item.subtotal, 0) ?? 0

  return (
    <Dialog open={order !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{order?.supplier?.name ?? '—'}</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString('es-MX', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
              <Badge variant={order.status === 'received' ? 'default' : 'secondary'}>
                {STATUS_LABELS[order.status] ?? order.status}
              </Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cant.</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.purchase_order_items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.product?.name ?? '—'}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{formatCurrency(item.unit_cost)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.subtotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>

            {order.notes && (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Nota</span>
                <p className="text-sm">{order.notes}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
