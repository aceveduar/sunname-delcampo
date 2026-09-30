import type { PurchaseOrder } from './usePurchaseOrders'
export const ORDER_STATUS_LABELS = {
  ordered: 'Pendiente',
  partial: 'Parcialmente recibida',
  received: 'Recibida',
  draft: 'Borrador',
  cancelled: 'Cancelada',
}
export function orderStatus(
  order: PurchaseOrder,
): keyof typeof ORDER_STATUS_LABELS {
  return order.status === 'ordered' &&
    order.purchase_order_items.some((item) => item.received_quantity > 0)
    ? 'partial'
    : order.status
}
export function pendingOrderItems(order: PurchaseOrder) {
  if (order.status !== 'ordered') return []
  return order.purchase_order_items
    .map((item) => ({
      ...item,
      remaining:
        Math.round((item.quantity - item.received_quantity) * 1000) / 1000,
    }))
    .filter((item) => item.remaining > 0)
}

export function remainingQuantity(
  item: PurchaseOrder['purchase_order_items'][number],
) {
  return Math.round((item.quantity - item.received_quantity) * 1000) / 1000
}
