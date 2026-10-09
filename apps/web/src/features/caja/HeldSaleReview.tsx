import { formatCurrency } from '@/lib/currency'
import { ProductName } from '@/components/ProductName'
import { saleTotal } from './heldSales'
import type { HeldSaleReview as Review } from './reviewHeldSale'

export function HeldSaleReview({
  review,
  previousTotal,
}: {
  review: Review
  previousTotal: number
}) {
  return (
    <div className="space-y-4">
      <div className="bg-muted/60 rounded-xl p-3">
        <p className="text-muted-foreground text-xs">Total al retomar</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatCurrency(review.total)}
        </p>
        {review.total !== previousTotal && (
          <p className="text-muted-foreground text-xs">
            Guardado: {formatCurrency(previousTotal)}
          </p>
        )}
        <p className="mt-2 text-sm">
          Cliente: {review.customerName ?? 'Sin cliente'}
        </p>
      </div>
      {review.warnings.length > 0 && (
        <div className="border-brand-gold/50 bg-brand-gold/10 rounded-lg border p-3">
          <p className="mb-2 font-medium">Revisa estos cambios</p>
          <ul className="list-disc space-y-2 pl-4 text-sm">
            {review.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {review.cart.length ? (
        <ul className="divide-y">
          {review.cart.map((line, index) => (
            <li
              key={index}
              className="flex items-start justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <ProductName name={line.product.name} />
                <p className="text-muted-foreground text-xs">
                  {line.product.sold_by_weight
                    ? Math.round(line.quantity * 1000) + ' g'
                    : line.quantity +
                      (line.quantity === 1 ? ' unidad' : ' unidades')}
                  {line.amountMxn !== undefined ? ' · Por monto' : ''}
                </p>
              </div>
              <span className="shrink-0 tabular-nums">
                {formatCurrency(saleTotal([line]))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No quedan productos disponibles. La venta seguirá en espera hasta que
          la descartes o vuelvas a revisarla.
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Existencias consultadas al revisar. No se reserva inventario; revisa las
        cantidades antes de cobrar.
      </p>
    </div>
  )
}
