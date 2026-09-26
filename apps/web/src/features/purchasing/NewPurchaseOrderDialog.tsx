import { useId, useRef, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { Product } from '@/features/catalog/useProducts'
import type { Supplier } from './useSuppliers'
import type { PurchaseOrderInput } from './useCreatePurchaseOrder'
import {
  seedPurchaseLines,
  validPurchaseLine,
  type PurchaseSeedLine,
  type PurchaseDraftLine,
} from './purchaseDraft'

export function NewPurchaseOrderDialog({
  suppliers,
  products,
  onCreate,
  initialLines = [],
  triggerLabel = 'Nueva orden',
  disabled = false,
}: {
  suppliers: Supplier[]
  products: Product[]
  onCreate: (values: PurchaseOrderInput) => Promise<boolean>
  initialLines?: PurchaseSeedLine[]
  triggerLabel?: string
  disabled?: boolean
}) {
  const id = useId()
  const online = useOnlineStatus()
  const [open, setOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [lines, setLines] = useState<PurchaseDraftLine[]>([])
  const [draftProductId, setDraftProductId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const busy = useRef(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const activeSuppliers = suppliers.filter((s) => s.active)
  const activeProducts = products.filter((p) => p.active)
  const selected = lines.filter((line) => line.selected)
  const valid =
    selected.length > 0 &&
    selected.every(validPurchaseLine) &&
    activeSuppliers.some((s) => s.id === supplierId)
  const total = selected.reduce(
    (sum, line) =>
      sum +
      (validPurchaseLine(line)
        ? Math.round(Number(line.quantity) * Number(line.unitCost) * 100) / 100
        : 0),
    0,
  )
  const handleOpenChange = (next: boolean) => {
    if (busy.current) return
    setOpen(next)
    if (next && !unconfirmed) {
      setSupplierId('')
      setLines(seedPurchaseLines(initialLines))
      setDraftProductId('')
      setNotes('')
    }
  }
  const editLine = (productId: string, values: Partial<PurchaseDraftLine>) =>
    setLines((previous) =>
      previous.map((line) =>
        line.productId === productId ? { ...line, ...values } : line,
      ),
    )
  const addLine = () => {
    if (
      !draftProductId ||
      lines.some((line) => line.productId === draftProductId)
    )
      return
    setLines((previous) => [
      ...previous,
      ...seedPurchaseLines([{ productId: draftProductId, quantity: 1 }]),
    ])
    setDraftProductId('')
  }
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!valid || !online || busy.current) return
    busy.current = true
    setSubmitting(true)
    try {
      const ok = await onCreate({
        supplierId,
        notes: notes.trim() || null,
        items: selected.map((line) => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost),
        })),
      })
      setUnconfirmed(!ok)
      if (ok) setOpen(false)
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger disabled={disabled} render={<Button size="sm" />}>
        <Plus />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl" showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>Nueva orden de compra</DialogTitle>
          <DialogDescription>
            Selecciona los productos, revisa cantidades e indica el costo
            acordado. El inventario cambia al recibir la orden.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex max-h-[70dvh] flex-col gap-4"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            <fieldset disabled={submitting} className="space-y-4">
              {unconfirmed && (
                <p role="status" className="text-sm">
                  Si el resultado fue incierto, reintenta sin cambiar los datos
                  para verificar la misma orden.
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor={id + 'supplier'}>Proveedor</Label>
                <Select
                  items={activeSuppliers.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  value={supplierId}
                  onValueChange={(value) => setSupplierId(value ?? '')}
                >
                  <SelectTrigger id={id + 'supplier'} className="w-full">
                    <SelectValue placeholder="Selecciona un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeSuppliers.length === 0 && (
                  <p className="text-sm">
                    Primero registra un proveedor activo en Compras.
                  </p>
                )}
              </div>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Label htmlFor={id + 'product'}>Agregar producto</Label>
                  <Select
                    items={activeProducts.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                    value={draftProductId}
                    onValueChange={(value) => setDraftProductId(value ?? '')}
                  >
                    <SelectTrigger id={id + 'product'} className="w-full">
                      <SelectValue placeholder="Producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLine}
                  disabled={
                    !draftProductId ||
                    lines.some((line) => line.productId === draftProductId)
                  }
                >
                  Agregar
                </Button>
              </div>
              {lines.map((line) => {
                const name =
                  products.find((p) => p.id === line.productId)?.name ??
                  'Producto no disponible'
                return (
                  <div
                    key={line.productId}
                    className="space-y-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex min-h-10 items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={line.selected}
                          onChange={(event) =>
                            editLine(line.productId, {
                              selected: event.target.checked,
                            })
                          }
                          aria-label={'Incluir ' + name}
                        />
                        {name}
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={'Quitar ' + name}
                        onClick={() =>
                          setLines((previous) =>
                            previous.filter(
                              (item) => item.productId !== line.productId,
                            ),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={id + line.productId + 'qty'}>
                          Cantidad
                        </Label>
                        <Input
                          id={id + line.productId + 'qty'}
                          aria-label={'Cantidad de ' + name}
                          type="number"
                          step="0.001"
                          min="0.001"
                          max="999999999.999"
                          required={line.selected}
                          disabled={!line.selected}
                          value={line.quantity}
                          onChange={(event) =>
                            editLine(line.productId, {
                              quantity: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={id + line.productId + 'cost'}>
                          Costo unitario
                        </Label>
                        <Input
                          id={id + line.productId + 'cost'}
                          aria-label={'Costo de ' + name}
                          type="number"
                          step="0.01"
                          min="0"
                          max="9999999999.99"
                          required={line.selected}
                          disabled={!line.selected}
                          value={line.unitCost}
                          onChange={(event) =>
                            editLine(line.productId, {
                              unitCost: event.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="space-y-1.5">
                <Label htmlFor={id + 'notes'}>Nota (opcional)</Label>
                <Textarea
                  id={id + 'notes'}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </fieldset>
          </div>
          <p className="flex shrink-0 justify-between font-semibold">
            <span>
              {selected.length}{' '}
              {selected.length === 1 ? 'producto' : 'productos'} · Total
              {!selected.every(validPurchaseLine) ? ' parcial' : ''}
            </span>
            <span>{formatCurrency(total)}</span>
          </p>
          <DialogFooter className="shrink-0">
            <Button type="submit" disabled={!valid || !online || submitting}>
              {submitting ? 'Confirmando…' : 'Crear orden'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
