import { Package } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { Product } from '@/features/catalog/useProducts'

export function ProductResultCard({
  product,
  rank,
  onClick,
}: {
  product: Product
  // Solo se pasa desde la rejilla de "Más vendidos" -- una búsqueda
  // normal nunca trae rank, así que nunca lleva insignia.
  rank?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="hover:bg-muted border-border bg-card flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors"
    >
      <div className="relative shrink-0">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt=""
            className="border-border size-10 rounded-md border object-cover"
          />
        ) : (
          <div className="border-border bg-muted flex size-10 items-center justify-center rounded-md border">
            <Package className="text-muted-foreground size-4" />
          </div>
        )}
        {rank !== undefined && rank <= 3 && (
          <span className="bg-brand-gold text-brand-gold-foreground absolute -top-1.5 -left-1.5 flex size-4.5 items-center justify-center rounded-full text-[10px] font-semibold">
            {rank}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className="line-clamp-2 min-h-[2lh] font-medium">{product.name}</span>
        {product.price === 0 ? (
          <span className="text-destructive text-sm font-medium">
            Sin precio
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">
            {product.sold_by_weight
              ? `${formatCurrency(product.price)}/kg · ${formatCurrency(product.price_per_100g ?? 0)}/100g`
              : formatCurrency(product.price)}
          </span>
        )}
      </div>
    </button>
  )
}
