import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PurchaseProductPicker } from './PurchaseProductPicker'
import { PurchaseLineEditor } from './PurchaseLineEditor'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { reportError } from '@/lib/errors'
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
  const [discard, setDiscard] = useState(false)
  const [initialDraft, setInitialDraft] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const busy = useRef(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const activeSuppliers = suppliers.filter((s) => s.active)
  const dirty =
    !!supplierId || !!notes || JSON.stringify(lines) !== initialDraft
  useEffect(() => {
    if (!unconfirmed && (!open || !dirty)) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [open, dirty, unconfirmed])
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
    if (!next && dirty && !unconfirmed) {
      setDiscard(true)
      return
    }
    setOpen(next)
    if (next && !unconfirmed) {
      setSupplierId('')
      setLines(seedPurchaseLines(initialLines))
      setInitialDraft(JSON.stringify(seedPurchaseLines(initialLines)))
      setNotes('')
    }
  }
  const editLine = (productId: string, values: Partial<PurchaseDraftLine>) =>
    setLines((previous) =>
      previous.map((line) =>
        line.productId === productId ? { ...line, ...values } : line,
      ),
    )
  const addLine = (productId: string) => {
    setLines((previous) =>
      previous.some((line) => line.productId === productId)
        ? previous
        : [...previous, ...seedPurchaseLines([{ productId, quantity: 1 }])],
    )
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
    } catch (cause) {
      reportError('No se pudo confirmar la orden', cause)
      setUnconfirmed(true)
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
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl"
        showCloseButton={!submitting}
      >
        <DialogHeader>
          <DialogTitle>Nueva orden de compra</DialogTitle>
          <DialogDescription>
            Selecciona los productos, revisa cantidades e indica el costo
            acordado. El inventario cambia al recibir la orden.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-4">
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            <fieldset disabled={submitting} className="space-y-4">
              {unconfirmed && (
                <p role="status" className="text-sm">
                  Si el resultado fue incierto, reintenta sin cambiar los datos
                  para verificar la misma orden. Tu captura se conserva al
                  cerrar este formulario.
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
              <PurchaseProductPicker
                products={products}
                included={new Set(lines.map((line) => line.productId))}
                onAdd={addLine}
              />
              <h3 className="text-sm font-semibold">
                Productos en la orden ({lines.length})
              </h3>
              {!lines.length && (
                <p className="text-muted-foreground text-sm">
                  Busca un producto arriba para empezar tu orden.
                </p>
              )}
              {lines.map((line) => {
                const name =
                  products.find((p) => p.id === line.productId)?.name ??
                  'Producto no disponible'
                return (
                  <PurchaseLineEditor
                    key={line.productId}
                    line={line}
                    name={name}
                    onChange={(values) => editLine(line.productId, values)}
                    onRemove={() =>
                      setLines((previous) =>
                        previous.filter(
                          (item) => item.productId !== line.productId,
                        ),
                      )
                    }
                  />
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
          {!online && (
            <p role="status" className="text-sm">
              Necesitas conexión para crear la orden.
            </p>
          )}
          <DialogFooter className="shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => handleOpenChange(false)}
            >
              Cerrar
            </Button>
            <Button type="submit" disabled={!valid || !online || submitting}>
              {submitting ? 'Confirmando…' : 'Crear orden'}
            </Button>
          </DialogFooter>
        </form>
        <ConfirmDialog
          open={discard}
          onOpenChange={setDiscard}
          title="¿Descartar esta orden?"
          description="La orden aún no se ha enviado. Perderás los productos, cantidades y notas de esta captura."
          confirmLabel="Descartar orden"
          variant="destructive"
          onConfirm={() => {
            setDiscard(false)
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
