import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { ReceivePurchaseDialog } from './ReceivePurchaseDialog'
import {
  ORDER_STATUS_LABELS,
  orderStatus,
  pendingOrderItems,
} from './orderPresentation'
import type { PurchaseOrder } from './usePurchaseOrders'

export function PurchaseOrderCard({
  order,
  userId,
  onView,
  onSaved,
  disabled = false,
}: {
  disabled?: boolean
  order: PurchaseOrder
  userId: string
  onView: () => void
  onSaved: () => Promise<void>
}) {
  const pending = pendingOrderItems(order)
  return (
    <article
      aria-label={'Orden ' + order.id.slice(0, 8)}
      className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold break-words">
            {order.supplier?.name ?? 'Proveedor no disponible'}
          </h3>
          <p className="text-muted-foreground text-xs">
            {new Date(order.ticket_date ?? order.created_at).toLocaleDateString(
              'es-MX',
              {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                timeZone: order.ticket_date ? 'UTC' : undefined,
              },
            )}{' '}
            · {order.id.slice(0, 8)}
          </p>
        </div>
        <Badge variant={order.status === 'received' ? 'default' : 'secondary'}>
          {ORDER_STATUS_LABELS[orderStatus(order)]}
        </Badge>
      </div>
      <p className="text-lg font-semibold tabular-nums">
        <span className="text-muted-foreground mr-2 text-xs font-normal">
          Total de la orden
        </span>
        {formatCurrency(
          order.purchase_order_items.reduce(
            (sum, item) => sum + item.subtotal,
            0,
          ),
        )}
      </p>
      {pending.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <p className="mb-1 font-medium">Pendiente de recibir</p>
          <ul className="space-y-1">
            {pending.slice(0, 2).map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">
                  {item.product?.name ?? 'Producto'}
                </span>
                <span className="shrink-0 tabular-nums">
                  {item.remaining} / {item.quantity} {item.product?.unit?.code}
                </span>
              </li>
            ))}
          </ul>
          {pending.length > 2 && (
            <p className="text-muted-foreground mt-1 text-xs">
              Y {pending.length - 2} renglones más; consulta el detalle.
            </p>
          )}
        </div>
      )}
      {(order.status === 'ordered' || order.status === 'received') &&
        order.purchase_order_items.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {
              order.purchase_order_items.filter((item) =>
                order.status === 'received'
                  ? item.received_quantity >= item.quantity
                  : item.received_quantity > 0,
              ).length
            }{' '}
            de {order.purchase_order_items.length} renglones{' '}
            {order.status === 'received' ? 'completos' : 'con entregas'}
          </p>
        )}
      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onView}
          aria-label={'Ver detalle de ' + (order.supplier?.name ?? 'orden')}
        >
          Ver detalle
        </Button>
        <ReceivePurchaseDialog
          order={order}
          disabled={disabled}
          userId={userId}
          onSaved={onSaved}
        />
      </div>
    </article>
  )
}
