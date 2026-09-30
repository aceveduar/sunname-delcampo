import { PurchaseQuantities } from './PurchaseQuantities'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
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
import { PurchaseReceiptHistory } from './PurchaseReceiptHistory'

import { ORDER_STATUS_LABELS, orderStatus } from './orderPresentation'

export function PurchaseOrderDetailDialog({
  order,
  onOpenChange,
}: {
  order: PurchaseOrder | null
  onOpenChange: (open: boolean) => void
}) {
  const total =
    order?.purchase_order_items.reduce((sum, item) => sum + item.subtotal, 0) ??
    0

  return (
    <Dialog open={order !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{order?.supplier?.name ?? '—'}</DialogTitle>
          <DialogDescription>
            Orden {order?.id.slice(0, 8)} · Cantidades y entregas registradas.
          </DialogDescription>
        </DialogHeader>
        {order && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {new Date(
                  order.ticket_date ?? order.created_at,
                ).toLocaleDateString('es-MX', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  timeZone: order.ticket_date ? 'UTC' : undefined,
                })}
              </span>
              <Badge
                variant={order.status === 'received' ? 'default' : 'secondary'}
              >
                {ORDER_STATUS_LABELS[orderStatus(order)]}
              </Badge>
            </div>

            <div className="grid gap-3 sm:hidden">
              {order.purchase_order_items.map((item) => (
                <article
                  key={item.id}
                  className="space-y-3 rounded-lg border p-3"
                >
                  <h3 className="font-medium wrap-break-word">
                    {item.product?.name ?? 'Producto'}
                  </h3>
                  <PurchaseQuantities item={item} />
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Costo: {formatCurrency(item.unit_cost)}
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Recibido</TableHead>
                    <TableHead>Pendiente</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.purchase_order_items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-normal">
                        {item.product?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        {item.quantity} {item.product?.unit?.code}
                      </TableCell>
                      <TableCell>
                        {item.received_quantity} {item.product?.unit?.code}
                      </TableCell>
                      <TableCell>
                        {Math.round(
                          (item.quantity - item.received_quantity) * 1000,
                        ) / 1000}{' '}
                        {item.product?.unit?.code}
                      </TableCell>
                      <TableCell>{formatCurrency(item.unit_cost)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>

            <PurchaseReceiptHistory key={order.id} orderId={order.id} />
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
