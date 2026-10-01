import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'

export function CashPaymentFields({
  total,
  value,
  change,
  onChange,
}: {
  total: number
  value: string
  change: number | null
  onChange: (value: string) => void
}) {
  const step = total < 100 ? 10 : total < 500 ? 50 : 100
  const next = (Math.floor(total / step) + 1) * step
  const suggestions = [
    ...new Set([next, next + step, 20, 50, 100, 200, 500, 1000]),
  ]
    .filter(
      (amount) => Number.isFinite(amount) && amount > total && amount < 1e10,
    )
    .sort((a, b) => a - b)
    .slice(0, 3)
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="sale-cash-received">Efectivo recibido</Label>
      <Input
        id="sale-cash-received"
        type="number"
        step="0.01"
        min="0"
        autoComplete="off"
        inputMode="decimal"
        placeholder="0.00"
        aria-describedby="sale-change"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Importes de efectivo recibido"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!Number.isFinite(total) || total <= 0}
          onClick={() => onChange(total.toFixed(2))}
        >
          Exacto
        </Button>
        {suggestions.map((amount) => (
          <Button
            key={amount}
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Recibí ${formatCurrency(amount)}`}
            onClick={() => onChange(amount.toFixed(2))}
          >
            {formatCurrency(amount).replace('.00', '')}
          </Button>
        ))}
      </div>
      <p
        id="sale-change"
        role="status"
        className={
          value === '' || !Number.isFinite(Number(value))
            ? 'text-muted-foreground text-sm'
            : change !== null && change < 0
              ? 'text-destructive text-sm font-semibold tabular-nums'
              : 'text-success text-lg font-semibold tabular-nums'
        }
      >
        {value === ''
          ? 'Ingresa el efectivo recibido para cobrar.'
          : !Number.isFinite(Number(value))
            ? 'Ingresa un importe válido.'
            : change !== null &&
              (change < 0
                ? `Falta ${formatCurrency(Math.abs(change))}`
                : `Cambio: ${formatCurrency(change)}`)}
      </p>
    </div>
  )
}
