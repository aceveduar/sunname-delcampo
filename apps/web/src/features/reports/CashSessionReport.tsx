import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import type { CashSessionRow } from './useSalesReport'

export function CashSessionReport({
  sessions,
}: {
  sessions: CashSessionRow[]
}) {
  const [onlyDifferences, setOnlyDifferences] = useState(false)
  const differences = sessions.filter((session) => session.difference !== 0)
  const visible = onlyDifferences ? differences : sessions
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Filtrar cortes">
        <Button
          variant={!onlyDifferences ? 'default' : 'outline'}
          aria-pressed={!onlyDifferences}
          onClick={() => setOnlyDifferences(false)}
        >
          Todos ({sessions.length})
        </Button>
        <Button
          variant={onlyDifferences ? 'default' : 'outline'}
          aria-pressed={onlyDifferences}
          onClick={() => setOnlyDifferences(true)}
        >
          Con diferencia ({differences.length})
        </Button>
      </div>
      {visible.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Todos los cortes mostrados cuadran.
        </p>
      )}
      <div className="grid gap-3 xl:grid-cols-2">
        {visible.map((session) => (
          <article
            key={session.id}
            className="min-w-0 space-y-4 rounded-xl border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium wrap-break-word">
                  {session.openedBy}
                </h3>
                <p className="text-muted-foreground text-xs">
                  Cierre: {new Date(session.closedAt).toLocaleString('es-MX')}
                </p>
              </div>
              <Badge
                variant={session.difference === 0 ? 'secondary' : 'destructive'}
              >
                {session.difference === 0
                  ? 'Cuadra'
                  : session.difference < 0
                    ? 'Faltante'
                    : 'Sobrante'}
              </Badge>
            </div>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground text-xs">Esperado</dt>
                <dd className="font-semibold tabular-nums">
                  {formatCurrency(session.expectedClosing)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Contado</dt>
                <dd className="font-semibold tabular-nums">
                  {formatCurrency(session.closingAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Diferencia</dt>
                <dd
                  className={`font-semibold tabular-nums ${session.difference !== 0 ? 'text-destructive' : 'text-success'}`}
                >
                  {formatCurrency(session.difference)}
                </dd>
              </div>
            </dl>
            <details className="border-t pt-3">
              <summary className="cursor-pointer rounded-md py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2">
                Ver desglose y observación
              </summary>
              <p className="text-muted-foreground mt-2 text-xs">
                Apertura: {new Date(session.openedAt).toLocaleString('es-MX')} ·
                Caja {session.id.slice(0, 8)}
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                {(
                  [
                    ['Monto inicial', session.openingAmount],
                    ['Ventas en efectivo', session.cashSales],
                    ['Entradas manuales', session.cashIn],
                    ['Salidas manuales', session.cashOut],
                  ] as const
                ).map(([label, amount]) => (
                  <div
                    key={label}
                    className="flex flex-wrap justify-between gap-2"
                  >
                    <dt>{label}</dt>
                    <dd className="tabular-nums">{formatCurrency(amount)}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-muted-foreground mt-3 text-xs">
                Esperado = monto inicial + ventas en efectivo + entradas −
                salidas. Diferencia = contado − esperado.
              </p>
              <div className="bg-muted/50 mt-3 rounded-lg p-3 text-sm">
                <p className="font-medium">Observación del cierre</p>
                <p className="mt-1 wrap-break-word whitespace-pre-wrap">
                  {session.notes || 'Sin observación registrada.'}
                </p>
              </div>
            </details>
          </article>
        ))}
      </div>
    </div>
  )
}
