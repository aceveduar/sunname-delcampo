import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import type { PaymentBreakdown as PaymentRow } from './reportTypes'

export function PaymentBreakdown({ rows }: { rows: PaymentRow[] }) {
  const total =
    rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobros por método de pago</CardTitle>
        <p className="text-muted-foreground text-xs">
          Participación en los cobros de ventas completadas. Excluye movimientos
          manuales de caja.
        </p>
      </CardHeader>
      <CardContent>
        {!rows.length ? (
          <p className="text-muted-foreground py-4 text-sm">
            Sin cobros de ventas en este periodo.
          </p>
        ) : (
          <ul className="space-y-5">
            {rows.map((row) => {
              const percent = total > 0 ? (row.amount / total) * 100 : 0
              return (
                <li key={row.id} className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 font-medium wrap-break-word">
                      {row.name}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(row.amount)}{' '}
                      <span className="text-muted-foreground ml-1 text-xs font-normal">
                        (
                        {percent.toLocaleString('es-MX', {
                          maximumFractionDigits: 1,
                        })}
                        %)
                      </span>
                    </span>
                  </div>
                  <div
                    aria-hidden
                    className="bg-muted h-2 overflow-hidden rounded-full"
                  >
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{
                        width: Math.max(0, Math.min(100, percent)) + '%',
                      }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {rows.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-between gap-2 border-t pt-3 text-sm font-semibold">
            <span>Total cobrado</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
