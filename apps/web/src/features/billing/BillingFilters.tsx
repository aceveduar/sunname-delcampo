import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BILLING_STATUSES,
  INITIAL_BILLING_VALUES,
  type BillingValues,
} from './billingData'

export function BillingFilters({
  onApply,
  loading,
}: {
  onApply: (values: BillingValues) => string | null
  loading: boolean
}) {
  const [values, setValues] = useState<BillingValues>(INITIAL_BILLING_VALUES)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="bg-card space-y-3 rounded-xl border p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault()
        setError(onApply(values))
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.3fr_auto] xl:items-end">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="billing-start">Desde (fecha de cierre)</Label>
          <Input
            id="billing-start"
            type="date"
            value={values.start}
            onChange={(e) => setValues({ ...values, start: e.target.value })}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="billing-end">Hasta</Label>
          <Input
            id="billing-end"
            type="date"
            value={values.end}
            onChange={(e) => setValues({ ...values, end: e.target.value })}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="billing-status">Estado de la solicitud</Label>
          <Select
            items={BILLING_STATUSES}
            value={values.status}
            onValueChange={(value) =>
              value &&
              setValues({ ...values, status: value as BillingValues['status'] })
            }
          >
            <SelectTrigger id="billing-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILLING_STATUSES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Consultando…' : 'Aplicar filtros'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => {
              setValues(INITIAL_BILLING_VALUES)
              setError(onApply(INITIAL_BILLING_VALUES))
            }}
          >
            Limpiar
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Deja ambas fechas vacías para consultar todo el historial.
      </p>
    </form>
  )
}
