import { useId } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'
import { validPurchaseLine, type PurchaseDraftLine } from './purchaseDraft'

export function PurchaseLineEditor({
  line,
  name,
  onChange,
  onRemove,
}: {
  line: PurchaseDraftLine
  name: string
  onChange: (values: Partial<PurchaseDraftLine>) => void
  onRemove: () => void
}) {
  const id = useId()
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-h-10 items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={line.selected}
            onChange={(event) =>
              onChange({
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
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={id + line.productId + 'qty'}>Cantidad</Label>
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
              onChange({
                quantity: event.target.value,
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id + line.productId + 'cost'}>Costo unitario</Label>
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
              onChange({
                unitCost: event.target.value,
              })
            }
          />
        </div>
      </div>
      <p className="text-muted-foreground text-right text-sm">
        Subtotal:{' '}
        {validPurchaseLine(line)
          ? formatCurrency(
              Math.round(Number(line.quantity) * Number(line.unitCost) * 100) /
                100,
            )
          : 'Completa cantidad y costo'}
      </p>
    </div>
  )
}
