import { useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { normalizeSearch } from '@/lib/text'
import type { Product } from '@/features/catalog/useProducts'

export function PurchaseProductPicker({
  products,
  included,
  onAdd,
}: {
  products: Product[]
  included: Set<string>
  onAdd: (productId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(6)
  const term = normalizeSearch(query.trim())
  const matches = products
    .filter(
      (p) =>
        p.active &&
        (!term ||
          normalizeSearch(p.name).includes(term) ||
          normalizeSearch(p.sku ?? '').includes(term)),
    )
    .sort(
      (a, b) =>
        Number(normalizeSearch(b.sku ?? '') === term) -
        Number(normalizeSearch(a.sku ?? '') === term),
    )
  return (
    <section
      className="bg-muted/30 space-y-3 rounded-xl border p-3"
      aria-label="Agregar productos"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Search aria-hidden className="size-4" />
        Agregar productos
      </div>
      <SearchInput
        value={query}
        onChange={(value) => {
          setQuery(value)
          setLimit(6)
        }}
        placeholder="Nombre o código del producto"
        aria-label="Buscar productos para la orden"
      />
      <ul
        className="max-h-52 space-y-1 overflow-y-auto"
        aria-label="Productos disponibles"
      >
        {matches.slice(0, limit).map((product) => (
          <li
            key={product.id}
            className="bg-background flex items-center justify-between gap-3 rounded-lg p-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium wrap-break-word">
                {product.name}
              </p>
              {product.sku && (
                <p className="text-muted-foreground text-xs break-all">
                  {product.sku}
                </p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={included.has(product.id)}
              aria-label={
                (included.has(product.id) ? 'En la orden: ' : 'Agregar ') +
                product.name
              }
              onClick={() => onAdd(product.id)}
            >
              {included.has(product.id) ? <Check /> : <Plus />}
              <span className="hidden sm:inline">
                {included.has(product.id) ? 'En la orden' : 'Agregar'}
              </span>
            </Button>
          </li>
        ))}
      </ul>
      {!matches.length && (
        <p role="status" className="text-muted-foreground text-sm">
          No hay productos activos con esa búsqueda.
        </p>
      )}
      {matches.length > limit && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setLimit(limit + 12)}
        >
          Ver más productos ({matches.length - limit})
        </Button>
      )}
      <p className="text-muted-foreground text-xs">
        Agrega varios productos y después revisa sus cantidades y costos.
      </p>
    </section>
  )
}
