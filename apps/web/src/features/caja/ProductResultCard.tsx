import { Package, Star } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { Product } from '@/features/catalog/useProducts'

export function ProductResultCard({
  product,
  rank,
  onClick,
  favorite = false,
  onToggleFavorite,
}: {
  favorite?: boolean
  onToggleFavorite?: () => void
  product: Product
  // Solo se pasa desde la rejilla de "Más vendidos" -- una búsqueda
  // normal nunca trae rank, así que nunca lleva insignia.
  rank?: number
  onClick: () => void
}) {
  return (
    <div className="bg-card hover:border-primary/30 focus-within:border-primary/40 relative flex rounded-xl border transition-[border-color,box-shadow] duration-150 hover:shadow-md">
      <button
        type="button"
        onClick={onClick}
        className="hover:bg-muted flex min-w-0 flex-1 items-start gap-2.5 rounded-lg p-3 text-left transition-colors"
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
          <span className="line-clamp-2 min-h-[2lh] font-medium">
            {product.name}
          </span>
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
      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={
            (favorite ? 'Quitar de favoritos: ' : 'Fijar favorito: ') +
            product.name
          }
          className="hover:bg-muted flex min-h-11 w-11 shrink-0 items-center justify-center self-start rounded-lg py-3"
        >
          <Star
            className={
              favorite
                ? 'text-brand-gold fill-brand-gold size-4'
                : 'text-muted-foreground size-4'
            }
          />
        </button>
      )}
    </div>
  )
}
