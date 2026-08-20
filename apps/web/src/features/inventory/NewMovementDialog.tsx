import { useState, type ComponentProps, type FormEvent, type ReactNode } from 'react'
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
import type { Database } from '@/lib/database.types'
import type { StockRow } from './useInventoryStock'

type MovementType = Database['public']['Enums']['inventory_movement_type']

export function NewMovementDialog({
  triggerLabel,
  triggerVariant = 'default',
  triggerSize = 'default',
  rows,
  initialProductId,
  onRegister,
}: {
  triggerLabel: ReactNode
  triggerVariant?: ComponentProps<typeof Button>['variant']
  triggerSize?: ComponentProps<typeof Button>['size']
  rows: StockRow[]
  initialProductId?: string
  onRegister: (values: {
    productId: string
    type: MovementType
    quantity: number
    notes: string | null
  }) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [productId, setProductId] = useState(initialProductId ?? '')
  const [type, setType] = useState<MovementType>('in')
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase')
  const [submitting, setSubmitting] = useState(false)

  const lockedProduct = rows.find((r) => r.product.id === initialProductId)?.product

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setProductId(initialProductId ?? '')
      setType('in')
      setDirection('increase')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!productId) return
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    const rawQuantity = Math.abs(Number(form.get('quantity') ?? 0))
    const quantity = type === 'adjustment' && direction === 'decrease' ? -rawQuantity : rawQuantity
    const notes = String(form.get('notes') ?? '').trim() || null

    const ok = await onRegister({ productId, type, quantity, notes })
    setSubmitting(false)
    if (ok) setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {lockedProduct ? (
            <div className="flex flex-col gap-1.5">
              <Label>Producto</Label>
              <p className="text-sm font-medium">{lockedProduct.name}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Producto</Label>
              <Select
                items={rows.map((r) => ({ value: r.product.id, label: r.product.name }))}
                value={productId}
                onValueChange={(value) => setProductId(value ?? '')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  {rows.map((r) => (
                    <SelectItem key={r.product.id} value={r.product.id}>
                      {r.product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Tipo de movimiento</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={type === 'in' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setType('in')}
              >
                Entrada
              </Button>
              <Button
                type="button"
                variant={type === 'adjustment' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setType('adjustment')}
              >
                Ajuste
              </Button>
            </div>
          </div>

          {type === 'adjustment' && (
            <div className="flex flex-col gap-1.5">
              <Label>Dirección del ajuste</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={direction === 'increase' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDirection('increase')}
                >
                  Aumentar
                </Button>
                <Button
                  type="button"
                  variant={direction === 'decrease' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDirection('decrease')}
                >
                  Disminuir
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input id="quantity" name="quantity" type="number" step="0.001" min="0.001" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Nota (opcional)</Label>
            <Textarea id="notes" name="notes" placeholder="Motivo del movimiento" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || !productId}>
              {submitting ? 'Guardando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
