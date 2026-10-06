import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react'
import { MovementPreview } from './MovementPreview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ProductName } from '@/components/ProductName'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { reportError } from '@/lib/errors'
import type { Database } from '@/lib/database.types'
import type { StockRow } from './useInventoryStock'
import { InventoryProductPicker } from './InventoryProductPicker'
import { parseMovementQuantity, projectedStock } from './stockQuantity'

type MovementType = Database['public']['Enums']['inventory_movement_type']
type Mode = 'in' | 'increase' | 'decrease'
const modes: { value: Mode; label: string; help: string }[] = [
  {
    value: 'in',
    label: 'Entrada',
    help: 'Suma mercancía que entra al inventario.',
  },
  {
    value: 'increase',
    label: 'Ajuste +',
    help: 'Corrige la existencia sumando la cantidad indicada.',
  },
  {
    value: 'decrease',
    label: 'Ajuste −',
    help: 'Corrige la existencia restando la cantidad indicada.',
  },
]
export function NewMovementDialog({
  triggerLabel,
  triggerVariant = 'default',
  triggerSize = 'default',
  rows,
  unitCode,
  initialProductId,
  onRegister,
  disabled = false,
}: {
  triggerLabel: ReactNode
  triggerVariant?: ComponentProps<typeof Button>['variant']
  triggerSize?: ComponentProps<typeof Button>['size']
  rows: StockRow[]
  unitCode: (unitId: string) => string
  initialProductId?: string
  disabled?: boolean
  onRegister: (values: {
    productId: string
    type: MovementType
    quantity: number
    notes: string | null
  }) => Promise<boolean>
}) {
  const id = useId()
  const online = useOnlineStatus()
  const [open, setOpen] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [productId, setProductId] = useState(initialProductId ?? '')
  const [mode, setMode] = useState<Mode>('in')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const selected = rows.find((row) => row.product.id === productId)
  const unit = selected ? unitCode(selected.product.unit_id) : ''
  const amount = parseMovementQuantity(quantity)
  const delta = amount === null ? null : mode === 'decrease' ? -amount : amount
  const projected =
    selected && delta !== null
      ? projectedStock(selected.quantityOnHand, delta)
      : null
  const dirty =
    !!quantity ||
    !!notes ||
    mode !== 'in' ||
    productId !== (initialProductId ?? '')
  useEffect(() => {
    if (!open || (!dirty && !submitting)) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [open, dirty, submitting])
  const changeOpen = (next: boolean) => {
    if (busy.current) return
    if (!next && dirty) {
      setDiscard(true)
      return
    }
    setOpen(next)
    if (next) {
      setProductId(initialProductId ?? '')
      setMode('in')
      setQuantity('')
      setNotes('')
      setError(null)
    }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy.current || disabled || !online || !selected || delta === null)
      return
    busy.current = true
    setSubmitting(true)
    setError(null)
    try {
      if (
        await onRegister({
          productId,
          type: mode === 'in' ? 'in' : 'adjustment',
          quantity: delta,
          notes: notes.trim() || null,
        })
      )
        setOpen(false)
      else
        setError(
          'No se confirmó el registro. Tu captura sigue aquí; revisa el historial antes de volver a registrar.',
        )
    } catch (cause) {
      reportError('No se pudo registrar el movimiento', cause)
      setError(
        'No se confirmó el registro. Tu captura sigue aquí; revisa el historial antes de volver a registrar.',
      )
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size={triggerSize}
            disabled={disabled || !rows.length}
          />
        }
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg"
        showCloseButton={!submitting}
      >
        <DialogHeader className="shrink-0 pr-7">
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>
            Elige el producto y revisa el cambio de existencia antes de guardar.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          className="flex min-h-0 flex-col gap-4"
          aria-busy={submitting}
        >
          <div className="min-h-0 overflow-y-auto px-1 py-1">
            <fieldset
              disabled={submitting || disabled}
              className="min-w-0 space-y-4"
            >
              <div className="space-y-1.5">
                <Label>Producto</Label>
                {initialProductId && selected ? (
                  <p className="font-medium wrap-break-word">
                    <ProductName name={selected.product.name} />
                  </p>
                ) : (
                  <InventoryProductPicker
                    rows={rows}
                    selectedId={productId}
                    unitCode={unitCode}
                    onSelect={(value) => {
                      setProductId(value)
                      setQuantity('')
                      setError(null)
                    }}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Tipo de movimiento</Label>
                <div
                  role="group"
                  aria-label="Tipo de movimiento"
                  className="flex flex-wrap gap-2"
                >
                  {modes.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={mode === option.value ? 'default' : 'outline'}
                      aria-pressed={mode === option.value}
                      onClick={() => setMode(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  {modes.find((option) => option.value === mode)?.help}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={id + '-quantity'}>
                  {mode === 'decrease'
                    ? 'Cantidad a restar'
                    : 'Cantidad a sumar'}
                  {unit ? ' (' + unit + ')' : ''}
                </Label>
                <Input
                  id={id + '-quantity'}
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  max="999999999.999"
                  step="0.001"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  aria-describedby={id + '-quantity-help'}
                  aria-invalid={quantity !== '' && amount === null}
                />
                <p
                  id={id + '-quantity-help'}
                  className="text-muted-foreground text-xs"
                >
                  Captura la diferencia, no el total contado. Hasta tres
                  decimales.
                </p>
              </div>
              {selected && (
                <MovementPreview
                  current={selected.quantityOnHand}
                  projected={projected}
                  delta={delta}
                  unit={unit}
                />
              )}
              <div className="space-y-1.5">
                <Label htmlFor={id + '-notes'}>Motivo (opcional)</Label>
                <Textarea
                  id={id + '-notes'}
                  placeholder="Por ejemplo: merma, conteo físico o entrada manual"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </fieldset>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {!online && (
            <p role="status" className="text-muted-foreground text-sm">
              Recupera la conexión para registrar el movimiento.
            </p>
          )}
          <DialogFooter className="shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => changeOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                disabled ||
                !online ||
                !selected ||
                amount === null
              }
            >
              {submitting ? 'Guardando…' : 'Registrar movimiento'}
            </Button>
          </DialogFooter>
        </form>
        <ConfirmDialog
          open={discard}
          onOpenChange={setDiscard}
          title="¿Descartar el movimiento?"
          description="La cantidad y el motivo sin guardar se perderán."
          confirmLabel="Descartar captura"
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
