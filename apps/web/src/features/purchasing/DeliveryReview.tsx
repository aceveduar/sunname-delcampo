import type { DeliveryInput } from './usePurchaseDelivery'
import type { PurchaseOrder } from './usePurchaseOrders'
import { remainingQuantity } from './orderPresentation'

export function DeliveryReview({
  order,
  delivery,
  pending,
}: {
  order: PurchaseOrder
  delivery: DeliveryInput
  pending: boolean
}) {
  return (
    <section className="space-y-3" aria-label="Resumen de la entrega">
      <p className="text-sm">
        {pending
          ? 'Estos son los datos enviados. Verifica la misma entrega para evitar duplicados.'
          : 'Revisa lo que llegó antes de actualizar el inventario.'}
      </p>
      <ul className="space-y-2">
        {delivery.items.map((row) => {
          const item = order.purchase_order_items.find(
            (item) => item.id === row.item_id,
          )
          const unit = item?.product?.unit?.code ?? ''
          return (
            <li
              key={row.item_id}
              className="space-y-1 rounded-lg border p-3 text-sm"
            >
              <p className="font-medium wrap-break-word">
                {item?.product?.name ?? 'Producto'}
              </p>
              <p className="font-semibold tabular-nums">
                Recibir: {row.quantity} {unit}
              </p>
              {!pending && item && (
                <p className="text-muted-foreground">
                  Quedará pendiente:{' '}
                  {Math.max(
                    0,
                    Math.round(
                      (remainingQuantity(item) - row.quantity) * 1000,
                    ) / 1000,
                  )}{' '}
                  {unit}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-sm">
        {delivery.items.length}{' '}
        {delivery.items.length === 1 ? 'renglón' : 'renglones'} en esta entrega.
      </p>
      {delivery.notes && (
        <p className="bg-muted rounded-lg p-3 text-sm wrap-break-word whitespace-pre-wrap">
          {delivery.notes}
        </p>
      )}
    </section>
  )
}
