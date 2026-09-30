import { remainingQuantity } from './orderPresentation'
import type { PurchaseOrder } from './usePurchaseOrders'

export type PurchaseItem = PurchaseOrder['purchase_order_items'][number]

export function PurchaseQuantities({ item }: { item: PurchaseItem }) {
  const unit = item.product?.unit?.code ?? ''
  return (
    <dl className="grid grid-cols-3 gap-2 text-sm">
      {[
        ['Pedido', item.quantity],
        ['Recibido', item.received_quantity],
        ['Pendiente', remainingQuantity(item)],
      ].map(([label, quantity]) => (
        <div key={label}>
          <dt className="text-muted-foreground text-xs">{label}</dt>
          <dd className="font-medium tabular-nums">
            {quantity} {unit}
          </dd>
        </div>
      ))}
    </dl>
  )
}
