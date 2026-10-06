import { useId } from 'react'
import { Banknote, Coins } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'
import {
  CASH_DENOMINATIONS,
  validCashCount,
  type CashCounts,
} from './cashCount'

export function CashDenominationCounter({
  counts,
  onChange,
  disabled,
}: {
  counts: CashCounts
  onChange: (counts: CashCounts) => void
  disabled: boolean
}) {
  const id = useId()
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="sr-only">Cantidad de billetes y monedas</legend>
      <p className="text-muted-foreground text-sm">
        Escribe cuántas piezas tienes. Los campos vacíos cuentan como cero.
      </p>
      {(['bill', 'coin'] as const).map((kind) => (
        <div key={kind} className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {kind === 'bill' ? (
              <Banknote aria-hidden className="size-4" />
            ) : (
              <Coins aria-hidden className="size-4" />
            )}
            {kind === 'bill' ? 'Billetes' : 'Monedas'}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {CASH_DENOMINATIONS.filter(
              (denomination) => denomination.kind === kind,
            ).map((denomination) => {
              const value = counts[denomination.id] ?? ''
              const valid = validCashCount(value)
              return (
                <div
                  key={denomination.id}
                  className="min-w-0 rounded-lg border p-2"
                >
                  <Label
                    htmlFor={id + denomination.id}
                    className="mb-1.5 block tabular-nums"
                  >
                    <span className="sr-only">
                      {kind === 'bill' ? 'Billetes de ' : 'Monedas de '}
                    </span>
                    {formatCurrency(denomination.cents / 100)}
                  </Label>
                  <Input
                    id={id + denomination.id}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="0"
                    value={value}
                    aria-invalid={!valid}
                    aria-describedby={!valid ? id + 'error' : undefined}
                    onChange={(event) =>
                      onChange({
                        ...counts,
                        [denomination.id]: event.target.value,
                      })
                    }
                  />
                  <p className="text-muted-foreground mt-1 text-right text-xs tabular-nums">
                    {valid
                      ? formatCurrency(
                          (Number(value) * denomination.cents) / 100,
                        )
                      : 'Revisa la cantidad'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {Object.values(counts).some((value) => !validCashCount(value)) && (
        <p id={id + 'error'} role="alert" className="text-destructive text-sm">
          Usa cantidades enteras entre 0 y 999999, sin signos ni decimales.
        </p>
      )}
    </fieldset>
  )
}
