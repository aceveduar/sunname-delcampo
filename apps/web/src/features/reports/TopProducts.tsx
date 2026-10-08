import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductName } from '@/components/ProductName'
import { formatCurrency } from '@/lib/currency'
import type { TopProduct } from './reportTypes'

export function TopProducts({ products }: { products: TopProduct[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos con mayor venta</CardTitle>
        <p className="text-muted-foreground text-xs">
          Hasta 10 productos, ordenados por importe vendido. Granel en KG; otras
          unidades según el catálogo actual.
        </p>
      </CardHeader>
      <CardContent>
        {!products.length ? (
          <p className="text-muted-foreground py-4 text-sm">
            Sin productos vendidos en este periodo.
          </p>
        ) : (
          <ol className="divide-y">
            {products.map((row, index) => (
              <li
                key={row.id}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span
                  className={
                    'flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ' +
                    (index === 0
                      ? 'bg-brand-gold/15 text-foreground'
                      : 'bg-muted text-muted-foreground')
                  }
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 basis-full text-sm font-medium wrap-break-word sm:flex-1 sm:basis-auto">
                      <ProductName name={row.name} />
                    </p>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(row.amount)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {row.quantity.toLocaleString('es-MX', {
                      maximumFractionDigits: 3,
                    })}{' '}
                    {row.unit}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
