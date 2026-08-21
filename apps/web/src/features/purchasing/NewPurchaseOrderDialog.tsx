import { useState, type FormEvent } from 'react'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { Product } from '@/features/catalog/useProducts'
import type { Supplier } from './useSuppliers'

type Line = { productId: string; quantity: number; unitCost: number }

export function NewPurchaseOrderDialog({
  suppliers,
  products,
  onCreate,
}: {
  suppliers: Supplier[]
  products: Product[]
  onCreate: (values: {
    supplierId: string
    notes: string | null
    items: { productId: string; quantity: number; unitCost: number }[]
  }) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [draftProductId, setDraftProductId] = useState('')
  const [draftQuantity, setDraftQuantity] = useState('1')
  const [draftUnitCost, setDraftUnitCost] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeSuppliers = suppliers.filter((s) => s.active)
  const total = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitCost,
    0,
  )

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setSupplierId('')
      setLines([])
      setDraftProductId('')
      setDraftQuantity('1')
      setDraftUnitCost('')
    }
  }

  const addLine = () => {
    const quantity = Number(draftQuantity)
    const unitCost = Number(draftUnitCost)
    if (!draftProductId || !(quantity > 0) || !(unitCost >= 0)) return

    setLines((prev) => {
      const existing = prev.find((line) => line.productId === draftProductId)
      if (existing) {
        return prev.map((line) =>
          line.productId === draftProductId
            ? { ...line, quantity: line.quantity + quantity, unitCost }
            : line,
        )
      }
      return [...prev, { productId: draftProductId, quantity, unitCost }]
    })
    setDraftProductId('')
    setDraftQuantity('1')
    setDraftUnitCost('')
  }

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((line) => line.productId !== productId))
  }

  const productName = (id: string) =>
    products.find((p) => p.id === id)?.name ?? '—'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supplierId || lines.length === 0) return
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    const notes = String(form.get('notes') ?? '').trim() || null

    const ok = await onCreate({
      supplierId,
      notes,
      items: lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost,
      })),
    })

    setSubmitting(false)
    if (ok) setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> Nueva orden
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva orden de compra</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex max-h-[75vh] flex-col overflow-hidden"
        >
          <div className="-mx-1 flex flex-col gap-4 overflow-x-hidden overflow-y-auto px-1 py-1">
            <div className="flex flex-col gap-1.5">
              <Label>Proveedor</Label>
              <Select
                items={activeSuppliers.map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
                value={supplierId}
                onValueChange={(value) => setSupplierId(value ?? '')}
              >
                <SelectTrigger className="w-full">
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
            </div>

            <div className="border-border flex flex-col gap-2 rounded-lg border p-3">
              <Label>Agregar producto</Label>
              <Select
                items={products.map((p) => ({ value: p.id, label: p.name }))}
                value={draftProductId}
                onValueChange={(value) => setDraftProductId(value ?? '')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Producto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="Cantidad"
                  value={draftQuantity}
                  onChange={(event) => setDraftQuantity(event.target.value)}
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Costo unitario"
                  value={draftUnitCost}
                  onChange={(event) => setDraftUnitCost(event.target.value)}
                />
                <Button type="button" variant="outline" onClick={addLine}>
                  Agregar
                </Button>
              </div>
            </div>

            {lines.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.productId}>
                      <TableCell>{productName(line.productId)}</TableCell>
                      <TableCell>{line.quantity}</TableCell>
                      <TableCell>{formatCurrency(line.unitCost)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(line.quantity * line.unitCost)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeLine(line.productId)}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {lines.length > 0 && (
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-notes">Nota (opcional)</Label>
              <Textarea id="po-notes" name="notes" />
            </div>
          </div>

          <DialogFooter className="border-border shrink-0 border-t pt-4">
            <Button
              type="submit"
              disabled={!supplierId || lines.length === 0 || submitting}
            >
              {submitting ? 'Creando…' : 'Crear orden'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
