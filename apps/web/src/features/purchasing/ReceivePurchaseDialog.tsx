import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DeliveryReview } from './DeliveryReview'
import { PurchaseQuantities } from './PurchaseQuantities'
import { deliveryQuantityError } from './deliveryQuantityError'
import { remainingQuantity } from './orderPresentation'
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
  disabled = false,
}: {
  disabled?: boolean
  order: PurchaseOrder
  userId: string
  onSaved: () => Promise<void>
}) {
  const delivery = usePurchaseDelivery(order.id, userId)
  const online = useOnlineStatus()
  const [open, setOpen] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const dirty =
    notes.trim() !== '' ||
    Object.values(quantities).some((value) => value.trim() !== '')
  const showReview = reviewing || !!delivery.pending
  function changeOpen(next: boolean) {
    if (delivery.busy) return
    if (!next && dirty && !delivery.pending) {
      setConfirmClose(true)
      return
    }
    setOpen(next)
  }
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
        row.quantity > 0 &&
        !deliveryQuantityError(
          String(row.quantity),
          remainingQuantity(item),
          item.product?.unit?.code ?? '',
        )
      )
    })
  if (order.status !== 'ordered' && !delivery.pending && !delivery.blocked)
    return null
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (
      (disabled && !delivery.pending) ||
      delivery.busy ||
      delivery.blocked ||
      (!valid && !delivery.pending) ||
      !online
    )
      return
    if (!showReview) {
      setReviewing(true)
      return
    }
    const receiving = delivery.pending?.items ?? selected
    if (await delivery.submit({ items: selected, notes: notes.trim() })) {
      setOpen(false)
      setReviewing(false)
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
      <Button
        variant="outline"
        size="sm"
        disabled={(disabled && !delivery.pending) || delivery.busy}
        onClick={() => setOpen(true)}
      >
        {delivery.pending ? 'Verificar entrega' : 'Recibir'}
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col overflow-hidden sm:max-w-xl"
          showCloseButton={!delivery.busy}
        >
          <DialogHeader className="pr-6">
            <DialogTitle>
              {showReview ? 'Revisar entrega' : 'Recibir mercancía'}
            </DialogTitle>
            <DialogDescription className="wrap-anywhere">
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
          <form
            onSubmit={submit}
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-1">
              {showReview && (
                <DeliveryReview
                  order={order}
                  delivery={
                    delivery.pending ?? { items: selected, notes: notes.trim() }
                  }
                  pending={!!delivery.pending}
                />
              )}
              <fieldset
                disabled={
                  disabled ||
                  delivery.busy ||
                  !!delivery.pending ||
                  delivery.blocked
                }
                className="space-y-3"
                hidden={showReview}
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
                {items.map((item) => {
                  const unit = item.product?.unit?.code ?? ''
                  const quantityError = deliveryQuantityError(
                    quantities[item.id] ?? '',
                    remainingQuantity(item),
                    unit,
                  )
                  return (
                    <div
                      key={item.id}
                      className="space-y-2 rounded-md border p-3"
                    >
                      <Label
                        className="wrap-anywhere"
                        htmlFor={`receive-${item.id}`}
                      >
                        {item.product?.name ?? 'Producto'}
                      </Label>
                      <PurchaseQuantities item={item} />
                      <Input
                        id={`receive-${item.id}`}
                        aria-invalid={!!quantityError}
                        aria-describedby={'quantity-hint-' + item.id}
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
                      <p
                        id={'quantity-hint-' + item.id}
                        className={
                          quantityError
                            ? 'text-destructive text-xs'
                            : 'text-muted-foreground text-xs'
                        }
                        role={quantityError ? 'alert' : undefined}
                      >
                        {quantityError ??
                          'Cantidad que llegó hoy' +
                            (unit ? ', en ' + unit : '') +
                            '.'}
                      </p>
                    </div>
                  )
                })}
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
            </div>
            {disabled && !delivery.pending && (
              <p role="status" className="text-sm">
                Actualiza Compras antes de registrar esta entrega.
              </p>
            )}
            <DialogFooter className="shrink-0">
              <Button
                type="button"
                variant="outline"
                disabled={delivery.busy}
                onClick={() => {
                  if (reviewing && !delivery.pending) setReviewing(false)
                  else changeOpen(false)
                }}
              >
                {reviewing && !delivery.pending
                  ? 'Editar cantidades'
                  : 'Volver'}
              </Button>
              <Button
                type="submit"
                disabled={
                  (disabled && !delivery.pending) ||
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
                    : reviewing
                      ? 'Confirmar entrega'
                      : 'Revisar entrega'}
              </Button>
            </DialogFooter>
          </form>
          <ConfirmDialog
            open={confirmClose}
            onOpenChange={setConfirmClose}
            title="¿Descartar la captura?"
            description="Tienes cantidades o notas sin registrar. Puedes seguir capturando o descartar estos cambios."
            confirmLabel="Descartar captura"
            variant="destructive"
            onConfirm={() => {
              setConfirmClose(false)
              setQuantities({})
              setNotes('')
              setReviewing(false)
              setOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
