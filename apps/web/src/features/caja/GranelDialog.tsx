import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import { granelTotalFromWeightKg, granelWeightKgFromAmount } from '@/lib/granel'
import type { Product } from '@/features/catalog/useProducts'

type Props = {
  product: Product | null
  initialGrams?: number
  initialAmount?: number
  editing?: boolean
  onConfirm: (weightKg: number, amountMxn?: number) => void
  onOpenChange: (open: boolean) => void
}

export function GranelDialog(props: Props) {
  return (
    <Dialog open={props.product !== null} onOpenChange={props.onOpenChange}>
      {props.product && (
        <GranelCapture
          key={props.product.id}
          {...props}
          product={props.product}
        />
      )}
    </Dialog>
  )
}

function GranelCapture({
  product,
  initialGrams,
  initialAmount,
  editing,
  onConfirm,
  onOpenChange,
}: Props & { product: Product }) {
  const [mode, setMode] = useState(
    initialAmount !== undefined ? 'amount' : 'weight',
  )
  const [unit, setUnit] = useState('g')
  const [weight, setWeight] = useState(
    initialGrams === undefined ? '' : String(initialGrams),
  )
  const [amount, setAmount] = useState(
    initialAmount === undefined ? '' : String(initialAmount),
  )
  const grams = Number(weight) * (unit === 'kg' ? 1000 : 1)
  const validWeight =
    Number.isFinite(grams) &&
    grams > 0 &&
    grams < 1e9 &&
    Math.abs(grams - Math.round(grams)) < 1e-6
  const money = Number(amount)
  const validAmount =
    Number.isFinite(money) &&
    money > 0 &&
    money < 1e10 &&
    Math.abs(money * 100 - Math.round(money * 100)) < 1e-5
  const hasPrice = product.price > 0 && (product.price_per_100g ?? 0) > 0
  const byAmount = mode === 'amount'
  const kg = byAmount
    ? granelWeightKgFromAmount(
        money,
        product.price,
        product.price_per_100g ?? 0,
      )
    : Math.round(grams) / 1000
  const total = byAmount
    ? money
    : granelTotalFromWeightKg(kg, product.price, product.price_per_100g ?? 0)
  const valid =
    hasPrice &&
    (byAmount ? validAmount : validWeight) &&
    Number.isFinite(kg) &&
    kg > 0 &&
    Number.isFinite(total) &&
    total > 0
  const caption = editing ? 'Guardar' : 'Agregar'
  const changeUnit = (next: string) => {
    if (weight !== '' && Number.isFinite(Number(weight))) {
      setWeight(
        String(
          next === 'kg'
            ? Number(weight) / 1000
            : Number((Number(weight) * 1000).toFixed(6)),
        ),
      )
    }
    setUnit(next)
  }
  return (
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{product.name}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'Corrige esta línea de la venta.'
            : 'Captura el peso de la báscula o el monto solicitado.'}
        </DialogDescription>
      </DialogHeader>
      {!hasPrice ? (
        <p role="alert">
          Este producto necesita precios válidos en Catálogo antes de venderlo.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {formatCurrency(product.price)}/kg desde 250 g ·{' '}
            {formatCurrency(product.price_per_100g ?? 0)}/100 g para menos de
            250 g
          </p>
          <div
            role="group"
            aria-label="Forma de captura"
            className="grid grid-cols-2 gap-2"
          >
            <Button
              type="button"
              variant={byAmount ? 'outline' : 'default'}
              aria-pressed={!byAmount}
              onClick={() => setMode('weight')}
            >
              Por peso
            </Button>
            <Button
              type="button"
              variant={byAmount ? 'default' : 'outline'}
              aria-pressed={byAmount}
              onClick={() => setMode('amount')}
            >
              Por monto
            </Button>
          </div>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (valid) onConfirm(kg, byAmount ? money : undefined)
            }}
          >
            {byAmount ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="granel-amount">
                  Monto pedido por el cliente
                </Label>
                <Input
                  id="granel-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  autoFocus
                  autoComplete="off"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="granel-weight">
                  Peso de la báscula ({unit})
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="granel-weight"
                    type="number"
                    inputMode="decimal"
                    min={unit === 'g' ? '1' : '0.001'}
                    step={unit === 'g' ? '1' : '0.001'}
                    autoFocus
                    autoComplete="off"
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                  />
                  <select
                    aria-label="Unidad de peso"
                    className="bg-background rounded-lg border px-2"
                    value={unit}
                    onChange={(event) => changeUnit(event.target.value)}
                  >
                    <option value="g">Gramos</option>
                    <option value="kg">Kilos</option>
                  </select>
                </div>
                <p className="text-muted-foreground text-xs">
                  Precisión de 1 gramo (0.001 kg).
                </p>
              </div>
            )}
            <div role="status" className="bg-muted/60 rounded-lg p-3">
              {valid ? (
                <>
                  <p className="text-sm">
                    {byAmount ? 'Peso a entregar' : 'Peso'}:{' '}
                    {Math.round(kg * 1000)} g · {kg} kg
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatCurrency(total)}
                  </p>
                </>
              ) : (
                <p className="text-sm">
                  {byAmount
                    ? 'Ingresa un monto positivo con hasta dos decimales.'
                    : 'Ingresa un peso positivo en gramos completos.'}
                </p>
              )}
            </div>
            <Button type="submit" disabled={!valid}>
              {valid
                ? caption +
                  ' ' +
                  Math.round(kg * 1000) +
                  ' g · ' +
                  formatCurrency(total)
                : caption}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </form>
        </>
      )}
    </DialogContent>
  )
}
