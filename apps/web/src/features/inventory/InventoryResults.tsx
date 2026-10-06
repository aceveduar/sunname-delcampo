import { Boxes, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductName } from '@/components/ProductName'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StockStatus } from './StockStatus'
import { formatStock } from './stockQuantity'
import type { StockRow } from './useInventoryStock'

function ProductIdentity({ row }: { row: StockRow }) {
  return (
    <div className="flex items-start gap-3">
      {row.product.image_url ? (
        <img
          src={row.product.image_url}
          alt=""
          loading="lazy"
          className="border-border bg-background size-10 shrink-0 rounded-lg border object-contain p-0.5"
        />
      ) : (
        <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border">
          <Package aria-hidden className="size-4" />
        </span>
      )}
      <div className="min-w-0 space-y-1">
        <p className="font-medium wrap-break-word whitespace-normal">
          <ProductName name={row.product.name} />
        </p>
        <p className="text-muted-foreground text-xs wrap-break-word whitespace-normal">
          {row.product.sku || 'Sin código'}
        </p>
      </div>
    </div>
  )
}
export function InventoryResults({
  rows,
  minimums,
  unitCode,
  loading,
  hasError,
  hasFilters,
  onClear,
  onOpen,
}: {
  rows: StockRow[]
  minimums: Map<string, number> | undefined
  unitCode: (id: string) => string
  loading: boolean
  hasError: boolean
  hasFilters: boolean
  onClear: () => void
  onOpen: (id: string, trigger: HTMLButtonElement) => void
}) {
  const minimumFor = (id: string) =>
    minimums ? (minimums.get(id) ?? 0) : undefined
  const minimumLabel = (id: string, unit: string) => {
    const value = minimumFor(id)
    return value === undefined
      ? 'No disponible'
      : value === 0
        ? 'Sin configurar'
        : formatStock(value) + ' ' + unit
  }
  if (!loading && !hasError && !rows.length)
    return (
      <div className="bg-card rounded-xl border p-4">
        <EmptyState
          icon={Boxes}
          title={hasFilters ? 'Sin coincidencias' : 'Aún no hay inventario'}
          description={
            hasFilters
              ? 'Prueba otro nombre o código, o limpia los filtros.'
              : 'Activa el control de inventario en los productos del catálogo para ver sus existencias aquí.'
          }
        />
        {hasFilters && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={onClear}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>
    )
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {loading &&
          !rows.length &&
          Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        {rows.map((row) => (
          <article
            key={row.product.id}
            className="bg-card space-y-4 rounded-xl border p-4"
          >
            <ProductIdentity row={row} />
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-muted-foreground text-xs">Existencia</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {formatStock(row.quantityOnHand)}{' '}
                  <span className="text-muted-foreground text-sm font-normal">
                    {unitCode(row.product.unit_id)}
                  </span>
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-muted-foreground text-xs">Mínimo</dt>
                <dd className="mt-1 text-sm tabular-nums">
                  {minimumLabel(row.product.id, unitCode(row.product.unit_id))}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StockStatus
                quantity={row.quantityOnHand}
                minimum={minimumFor(row.product.id)}
              />
              <Button
                variant="outline"
                size="sm"
                aria-label={'Ver detalle de ' + row.product.name}
                onClick={(e) => onOpen(row.product.id, e.currentTarget)}
              >
                Ver detalle
              </Button>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table className="w-full min-w-[42rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Producto / código</TableHead>
              <TableHead className="text-right">Existencia</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Detalle</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !rows.length && (
              <TableSkeletonRows rows={6} columns={5} />
            )}
            {rows.map((row) => (
              <TableRow key={row.product.id}>
                <TableCell className="max-w-md py-3">
                  <ProductIdentity row={row} />
                </TableCell>
                <TableCell
                  className={
                    'text-right text-base font-semibold tabular-nums ' +
                    (row.quantityOnHand <= 0 ? 'text-destructive' : '')
                  }
                >
                  {formatStock(row.quantityOnHand)}{' '}
                  <span className="text-muted-foreground text-xs font-normal">
                    {unitCode(row.product.unit_id)}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                  {minimumLabel(row.product.id, unitCode(row.product.unit_id))}
                </TableCell>
                <TableCell>
                  <StockStatus
                    quantity={row.quantityOnHand}
                    minimum={minimumFor(row.product.id)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={'Ver detalle de ' + row.product.name}
                    onClick={(e) => onOpen(row.product.id, e.currentTarget)}
                  >
                    Ver detalle
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
