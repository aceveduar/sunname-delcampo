import { Package, Star } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { Product } from '@/features/catalog/useProducts'

export function ProductResultCard({
  product,
  rank,
  onClick,
  favorite = false,
  onToggleFavorite,
  compact = false,
}: {
  product: Product
  rank?: number
  onClick: () => void
  favorite?: boolean
  onToggleFavorite?: () => void
  compact?: boolean
}) {
  return (
    <div className="bg-card hover:border-primary/30 focus-within:border-primary/40 relative flex rounded-xl border transition-[border-color,box-shadow] duration-150 hover:shadow-sm">
      <button
        type="button"
        onClick={onClick}
        className="hover:bg-muted flex min-w-0 flex-1 flex-col gap-3 rounded-xl p-3 text-left transition-colors"
      >
        <span className="flex w-full items-start gap-2.5">
          <span className="relative shrink-0">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt=""
                loading="lazy"
                className={
                  'border-border bg-background rounded-md border object-contain p-0.5 ' +
                  (compact ? 'size-8' : 'size-10')
                }
              />
            ) : (
              <span
                className={
                  'border-border bg-muted flex items-center justify-center rounded-md border ' +
                  (compact ? 'size-8' : 'size-10')
                }
              >
                <Package aria-hidden className="text-muted-foreground size-4" />
              </span>
            )}
            {rank !== undefined && rank <= 3 && (
              <span className="bg-brand-gold text-brand-gold-foreground absolute -top-1.5 -left-1.5 flex size-4.5 items-center justify-center rounded-full text-[10px] font-semibold">
                {rank}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1 text-sm leading-snug font-medium wrap-break-word">
            {product.name}
          </span>
        </span>
        <span
          className={
            'mt-auto flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 ' +
            (onToggleFavorite ? 'pr-10' : '')
          }
        >
          {product.price === 0 ? (
            <span className="text-destructive text-sm font-medium">
              Sin precio
            </span>
          ) : (
            <>
              <span className="text-foreground text-base font-semibold tabular-nums">
                {formatCurrency(product.price)}
                {product.sold_by_weight && (
                  <span className="text-muted-foreground text-xs font-normal">
                    /kg
                  </span>
                )}
              </span>
              {product.sold_by_weight && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatCurrency(product.price_per_100g ?? 0)}/100 g
                </span>
              )}
            </>
          )}
        </span>
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
          className="hover:bg-muted absolute right-1 bottom-1 flex size-11 items-center justify-center rounded-lg"
        >
          <Star
            aria-hidden
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
