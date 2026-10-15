import { DeferredImage } from '@/components/DeferredImage'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { ReactNode } from 'react'
import { AlertTriangle, Package, PackageSearch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/EmptyState'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { formatCurrency } from '@/lib/currency'
import { isEnPerdida } from '@/lib/pricing'
import type { Product } from './useProducts'

export type ProductView = 'table' | 'cards'

/** Comparte información y acciones entre la tabla amplia y las tarjetas compactas. */
export function ProductDirectory({
  products,
  view,
  loading,
  error,
  hasFilters,
  categoryName,
  unitCode,
  costsById,
  actions,
}: {
  products: Product[]
  view: ProductView
  loading: boolean
  error: string | null
  hasFilters: boolean
  categoryName: (id: string | null) => string
  unitCode: (id: string) => string
  costsById: ReadonlyMap<string, number>
  actions?: (product: Product) => ReactNode
}) {
  const wide = useMediaQuery('(min-width: 64rem)')
  const showTable = view === 'table' && wide
  const photo = (product: Product, table = false) => (
    <div
      className={`bg-muted border-border shrink-0 overflow-hidden rounded-lg border p-1.5 ${table ? 'size-14' : 'size-16'}`}
    >
      {product.image_url ? (
        <DeferredImage
          src={product.image_url}
          alt=""
          className="size-full object-contain"
        />
      ) : (
        <div className="text-muted-foreground flex size-full items-center justify-center">
          <Package className="size-6" />
        </div>
      )}
    </div>
  )
  const state = (product: Product) => (
    <Badge
      variant="outline"
      className={
        product.active
          ? 'border-success/20 bg-success/10 text-success'
          : 'text-muted-foreground'
      }
    >
      {product.active ? 'Activo' : 'Inactivo'}
    </Badge>
  )
  const price = (product: Product) => (
    <div className="space-y-0.5">
      <p className="font-semibold tabular-nums">
        <span className="whitespace-nowrap">
          {product.price === 0 ? 'Sin precio' : formatCurrency(product.price)}
        </span>
        <span className="text-muted-foreground ml-1 text-xs font-normal wrap-anywhere">
          / {product.sold_by_weight ? 'kg' : unitCode(product.unit_id)}
        </span>
      </p>
      {product.sold_by_weight &&
        (product.price > 0 || (product.price_per_100g ?? 0) > 0) && (
          <p className="text-muted-foreground text-xs">
            {product.price_per_100g == null || product.price_per_100g === 0 ? (
              'Sin precio por 100 g'
            ) : (
              <span className="whitespace-nowrap">
                {formatCurrency(product.price_per_100g)} / 100 g
              </span>
            )}
          </p>
        )}
    </div>
  )
  const warnings = (product: Product) => {
    if (!actions) return null
    const cost = costsById.get(product.id)
    const loss =
      cost !== undefined &&
      isEnPerdida({ active: product.active, price: product.price, cost })
    if (!loss && !(product.active && product.price === 0)) return null
    return (
      <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
        <AlertTriangle className="size-3 shrink-0" />
        {product.active && product.price === 0
          ? 'Activo sin precio'
          : 'En pérdida'}
      </p>
    )
  }
  if (!products.length && !loading) {
    if (error) return null
    return (
      <div className="bg-card rounded-xl border">
        <EmptyState
          icon={PackageSearch}
          title={
            hasFilters
              ? 'No encontramos coincidencias'
              : 'Aún no hay productos en el catálogo'
          }
          description={
            hasFilters
              ? 'Prueba otro nombre o código, o limpia los filtros.'
              : actions
                ? 'Usa “Nuevo producto” para empezar a vender.'
                : 'El administrador puede agregar productos al catálogo.'
          }
        />
      </div>
    )
  }
  return (
    <section aria-label="Resultados de productos" aria-busy={loading}>
      {!showTable && (
        <div
          aria-label="Tarjetas de productos"
          className={`grid gap-3 md:grid-cols-2 ${view === 'table' ? 'lg:hidden' : 'xl:grid-cols-3'}`}
        >
          {loading &&
            !products.length &&
            Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-40 rounded-xl" />
            ))}
          {products.map((product) => (
            <article
              key={product.id}
              aria-label={product.name}
              className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-3 shadow-sm"
            >
              <div className="flex items-start gap-3">
                {photo(product)}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm leading-snug font-semibold wrap-anywhere">
                    {product.name}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-xs wrap-anywhere">
                    {categoryName(product.category_id)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs wrap-anywhere">
                    Código: {product.sku?.trim() || 'Sin código'}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <div>
                  {price(product)}
                  {warnings(product)}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {state(product)}
                  {actions?.(product)}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {showTable && (
        <div className="hidden lg:block" aria-label="Tabla de productos">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio de venta</TableHead>
                <TableHead>Estado</TableHead>
                {actions && (
                  <TableHead className="text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !products.length && (
                <TableSkeletonRows rows={6} columns={actions ? 5 : 4} />
              )}
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="max-w-sm whitespace-normal">
                    <div className="flex items-center gap-3">
                      {photo(product, true)}
                      <div className="min-w-0">
                        <p className="font-medium wrap-anywhere">
                          {product.name}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs wrap-anywhere">
                          {product.sku?.trim() || 'Sin código'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-48 wrap-anywhere whitespace-normal">
                    {categoryName(product.category_id)}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {price(product)}
                    {warnings(product)}
                  </TableCell>
                  <TableCell>{state(product)}</TableCell>
                  {actions && <TableCell>{actions(product)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
