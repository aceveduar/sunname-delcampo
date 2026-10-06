import { useId, useRef } from 'react'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useScrollShadows } from '@/hooks/useScrollShadows'
import type { Product } from '@/features/catalog/useProducts'
import { ProductResultCard } from './ProductResultCard'

export function FavoriteProductStrip({
  products,
  ids,
  onToggle,
  onChoose,
}: {
  products: Product[]
  ids: string[]
  onToggle: (id: string) => void
  onChoose: (product: Product) => void
}) {
  const id = useId()
  const contentRef = useRef<HTMLDivElement>(null)
  const available = ids
    .map((key) =>
      products.find((product) => product.id === key && product.active),
    )
    .filter((product): product is Product => !!product)
  const unavailable = ids.filter(
    (key) => !available.some((product) => product.id === key),
  )
  const { ref, canScrollStart, canScrollEnd, onScroll } =
    useScrollShadows<HTMLDivElement>({
      axis: 'horizontal',
      contentRef,
      extraDep: available.length,
    })
  const move = (direction: number) => {
    const element = ref.current
    if (element)
      element.scrollBy({ left: direction * element.clientWidth * 0.8 })
  }
  return (
    <section aria-label="Mis favoritos" className="min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Star aria-hidden className="text-brand-gold size-4" />
          <h2 className="text-sm font-semibold">Mis favoritos</h2>
          <span className="text-muted-foreground text-xs">
            {available.length}/12
          </span>
        </div>
        <div
          className={
            'flex gap-1 ' +
            (!canScrollStart && !canScrollEnd ? 'invisible' : '')
          }
        >
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={!canScrollStart}
            aria-label="Ver favoritos anteriores"
            aria-controls={id}
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={!canScrollEnd}
            aria-label="Ver favoritos siguientes"
            aria-controls={id}
            onClick={() => move(1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      {available.length ? (
        <div
          ref={ref}
          id={id}
          onScroll={onScroll}
          className="snap-x snap-mandatory scroll-px-1 overflow-x-auto overscroll-x-contain py-1"
        >
          <div ref={contentRef} className="flex w-max items-stretch gap-2 px-1">
            {available.map((product) => (
              <div
                key={product.id}
                className="flex w-64 max-w-[calc(100vw-3.5rem)] shrink-0 snap-start [&>div]:w-full"
              >
                <ProductResultCard
                  product={product}
                  compact
                  favorite
                  onToggleFavorite={() => onToggle(product.id)}
                  onClick={() => onChoose(product)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Marca una estrella para tener aquí tus productos frecuentes.
        </p>
      )}
      {unavailable.map((key) => (
        <div
          key={key}
          className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm"
        >
          <span>
            {products.find((product) => product.id === key)?.name ??
              'Producto no disponible'}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggle(key)}
          >
            Quitar favorito
          </Button>
        </div>
      ))}
    </section>
  )
}
