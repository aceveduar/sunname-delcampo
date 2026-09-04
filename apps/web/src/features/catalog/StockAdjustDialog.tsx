import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRegisterMovement } from '@/features/inventory/useRegisterMovement'
import type { Product } from './useProducts'

/** Ajustar existencia sin salir de Catálogo. Registra el mismo tipo de
 * movimiento que ya usa Inventario (bitácora inmutable, nunca un campo
 * de cantidad editable a mano -- CLAUDE.md §15, 2026-08-20) -- aquí
 * solo se fija el producto de antemano, para no obligar a salir de la
 * pantalla y buscarlo otra vez en Inventario. */
export function StockAdjustDialog({
  product,
  unitLabel,
  onOpenChange,
  onDone,
}: {
  product: Product | null
  unitLabel: string
  onOpenChange: (open: boolean) => void
  onDone: () => void | Promise<void>
}) {
  const registerMovement = useRegisterMovement(onDone)
  const [type, setType] = useState<'in' | 'adjustment'>('in')
  const [direction, setDirection] = useState<'increase' | 'decrease'>(
    'increase',
  )
  const [submitting, setSubmitting] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setType('in')
      setDirection('increase')
    }
    onOpenChange(next)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!product) return
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    const rawQuantity = Math.abs(Number(form.get('quantity') ?? 0))
    const quantity =
      type === 'adjustment' && direction === 'decrease'
        ? -rawQuantity
        : rawQuantity
    const notes = String(form.get('notes') ?? '').trim() || null

    const ok = await registerMovement({
      productId: product.id,
      type,
      quantity,
      notes,
    })
    setSubmitting(false)
    if (ok) handleOpenChange(false)
  }

  return (
    <Dialog open={product !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar existencia</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Producto</Label>
            <p className="text-sm font-medium">{product?.name}</p>
          </div>

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
            <Label htmlFor="stock-adjust-quantity">
              Cantidad{unitLabel ? ` (${unitLabel})` : ''}
            </Label>
            <Input
              id="stock-adjust-quantity"
              name="quantity"
              type="number"
              step="0.001"
              min="0.001"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stock-adjust-notes">Nota (opcional)</Label>
            <Textarea
              id="stock-adjust-notes"
              name="notes"
              placeholder="Motivo del movimiento"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
