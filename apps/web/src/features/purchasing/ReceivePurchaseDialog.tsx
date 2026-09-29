import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isEnPerdida } from '@/lib/pricing'
import { usePurchaseDelivery } from './usePurchaseDelivery'
import type { PurchaseOrder } from './usePurchaseOrders'

export function ReceivePurchaseDialog({
  order,
  userId,
  onSaved,
}: {
  order: PurchaseOrder
  userId: string
  onSaved: () => Promise<void>
}) {
  const delivery = usePurchaseDelivery(order.id, userId)
  const online = useOnlineStatus()
  const [open, setOpen] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const items = order.purchase_order_items
  const selected = items
    .map((item) => ({
      item_id: item.id,
      quantity: Number(quantities[item.id] ?? ''),
    }))
    .filter((item) => item.quantity !== 0)
  const valid =
    selected.length > 0 &&
    selected.every((row) => {
      const item = items.find((item) => item.id === row.item_id)!
      return (
        Number.isFinite(row.quantity) &&
        row.quantity > 0 &&
        Math.abs(row.quantity * 1000 - Math.round(row.quantity * 1000)) <
          1e-6 &&
        row.quantity <=
          Math.round((item.quantity - item.received_quantity) * 1000) / 1000
      )
    })
  if (order.status !== 'ordered' && !delivery.pending && !delivery.blocked)
    return null
  async function submit(event: FormEvent) {
    event.preventDefault()
    if ((!valid && !delivery.pending) || !online) return
    const receiving = delivery.pending?.items ?? selected
    if (await delivery.submit({ items: selected, notes: notes.trim() })) {
      setOpen(false)
      setQuantities({})
      setNotes('')
      toast.success('Entrega registrada. Inventario actualizado.')
      const atLoss = items.filter(
        (item) =>
          receiving.some((row) => row.item_id === item.id) &&
          item.product &&
          item.unit_cost > 0 &&
          isEnPerdida({
            active: item.product.active,
            price: item.product.price,
            cost: item.unit_cost,
          }),
      )
      if (atLoss.length)
        toast.warning(
          `Revisa los precios de venta: ${atLoss.map((item) => item.product!.name).join(', ')}. El costo alcanzó o superó el precio de venta.`,
        )
      await onSaved()
    }
  }
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {delivery.pending ? 'Verificar entrega' : 'Recibir'}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!delivery.busy) setOpen(next)
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
          showCloseButton={!delivery.busy}
        >
          <DialogHeader>
            <DialogTitle>Recibir mercancía</DialogTitle>
            <DialogDescription>
              {order.supplier?.name}. Captura solo lo que llegó hoy. Lo demás
              quedará pendiente.
            </DialogDescription>
          </DialogHeader>
          {delivery.error && (
            <p role="alert" className="text-destructive text-sm">
              {delivery.error}
            </p>
          )}
          {delivery.pending && (
            <p role="status" className="text-sm">
              Hay una entrega pendiente de confirmación. Reintentar no duplica
              el inventario.
            </p>
          )}
          <form onSubmit={submit} className="space-y-4">
            <fieldset
              disabled={delivery.busy || !!delivery.pending || delivery.blocked}
              className="space-y-3"
            >
              <legend className="sr-only">Cantidades recibidas</legend>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setQuantities(
                    Object.fromEntries(
                      items.map((item) => [
                        item.id,
                        String(
                          Math.round(
                            (item.quantity - item.received_quantity) * 1000,
                          ) / 1000,
                        ),
                      ]),
                    ),
                  )
                }
              >
                Completar lo pendiente
              </Button>
              {items.map((item) => (
                <div key={item.id} className="space-y-2 rounded-md border p-3">
                  <Label htmlFor={`receive-${item.id}`}>
                    {item.product?.name ?? 'Producto'}
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Pedido: {item.quantity} · Recibido: {item.received_quantity}{' '}
                    · Pendiente:{' '}
                    {Math.round(
                      (item.quantity - item.received_quantity) * 1000,
                    ) / 1000}
                  </p>
                  <Input
                    id={`receive-${item.id}`}
                    aria-label={`Recibir ${item.product?.name ?? 'producto'}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={
                      Math.round(
                        (item.quantity - item.received_quantity) * 1000,
                      ) / 1000
                    }
                    step="0.001"
                    disabled={item.received_quantity === item.quantity}
                    placeholder="0"
                    value={
                      delivery.pending?.items.find(
                        (row) => row.item_id === item.id,
                      )?.quantity ??
                      quantities[item.id] ??
                      ''
                    }
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <Label htmlFor={`delivery-notes-${order.id}`}>
                Nota de la entrega (opcional)
              </Label>
              <Textarea
                id={`delivery-notes-${order.id}`}
                maxLength={1000}
                value={delivery.pending?.notes ?? notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </fieldset>
            {!online && (
              <p role="status">Necesitas conexión para recibir mercancía.</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={delivery.busy}
                onClick={() => setOpen(false)}
              >
                Volver
              </Button>
              <Button
                type="submit"
                disabled={
                  delivery.busy ||
                  delivery.blocked ||
                  !online ||
                  (!valid && !delivery.pending)
                }
              >
                {delivery.busy
                  ? 'Confirmando…'
                  : delivery.pending
                    ? 'Reintentar confirmación'
                    : 'Registrar entrega'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
