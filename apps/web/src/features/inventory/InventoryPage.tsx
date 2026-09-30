import { InventoryProductPanel } from './InventoryProductPanel'
import { useInventoryMinimums } from './useInventoryMinimums'
import {
  downloadReplenishment,
  needsReplenishment,
  replenishmentCsv,
} from './replenishment'
import { LoadError } from '@/components/LoadError'
import { Skeleton } from '@/components/ui/skeleton'
import { StockStatus } from './StockStatus'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Boxes, ImageOff, ScanBarcode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BarcodeScannerDialog } from '@/components/BarcodeScannerDialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PaginationControls } from '@/components/PaginationControls'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { EmptyState } from '@/components/EmptyState'
import { NO_CATEGORY, useCategories } from '@/features/catalog/useCategories'
import { useUnits } from '@/features/catalog/useUnits'
import type { Database } from '@/lib/database.types'
import { usePagination } from '@/lib/usePagination'
import { normalizeSearch } from '@/lib/text'
import { useInventoryStock } from './useInventoryStock'
import { useRegisterMovement } from './useRegisterMovement'
import { NewMovementDialog } from './NewMovementDialog'

type Role = Database['public']['Enums']['user_role']

const CAN_REGISTER_MOVEMENTS: Role[] = ['owner', 'local_admin']

export function InventoryPage({
  role,
  renderReplenishment,
}: {
  role: Role | null
  renderReplenishment?: (
    rows: ReturnType<typeof useInventoryStock>['rows'],
    minimums: Map<string, number>,
    disabled: boolean,
  ) => ReactNode
}) {
  const { rows, loading, error, refresh } = useInventoryStock()
  const {
    units,
    error: unitsError,
    loading: unitsLoading,
    refresh: refreshUnits,
  } = useUnits()
  const {
    categories,
    error: categoriesError,
    loading: categoriesLoading,
    refresh: refreshCategories,
  } = useCategories()
  const registerMovement = useRegisterMovement(refresh)
  const {
    minimums,
    error: minimumsError,
    loading: minimumsLoading,
    refresh: refreshMinimums,
    saveMinimum,
  } = useInventoryMinimums()
  const [stockFilter, setStockFilter] = useState<'all' | 'out' | 'low'>('all')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  )
  const [scannerOpen, setScannerOpen] = useState(false)
  const detailTrigger = useRef<HTMLButtonElement | null>(null)

  const selectedRow = rows.find((row) => row.product.id === selectedProductId)
  const hasFilters =
    search !== '' || filterCategory !== 'all' || stockFilter !== 'all'

  const canRegister = role !== null && CAN_REGISTER_MOVEMENTS.includes(role)
  const activeCategories = categories.filter((c) => c.active)

  const unitCode = (unitId: string) =>
    units.find((u) => u.id === unitId)?.code ?? ''

  const filteredRows = useMemo(() => {
    const query = normalizeSearch(search)
    return rows.filter((row) => {
      if (stockFilter === 'out' && row.quantityOnHand > 0) return false
      if (
        stockFilter === 'low' &&
        !needsReplenishment(
          row.quantityOnHand,
          minimums.get(row.product.id) ?? 0,
        )
      )
        return false
      if (
        query &&
        !normalizeSearch(row.product.name).includes(query) &&
        !(row.product.sku && normalizeSearch(row.product.sku).includes(query))
      )
        return false
      if (filterCategory === NO_CATEGORY && row.product.category_id)
        return false
      if (
        filterCategory !== 'all' &&
        filterCategory !== NO_CATEGORY &&
        row.product.category_id !== filterCategory
      )
        return false
      return true
    })
  }, [rows, search, filterCategory, stockFilter, minimums])

  const { pageItems, page, setPage, totalPages, totalItems, pageSize } =
    usePagination(filteredRows)

  return (
    <div className="flex flex-col gap-6">
      <LoadError
        message={minimumsError}
        onRetry={refreshMinimums}
        loading={minimumsLoading}
      />
      <LoadError message={error} onRetry={refresh} loading={loading} />
      <LoadError
        message={categoriesError}
        onRetry={refreshCategories}
        loading={categoriesLoading}
      />
      <LoadError
        message={unitsError}
        onRetry={refreshUnits}
        loading={unitsLoading}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Inventario</h1>
          <p className="text-muted-foreground text-sm">
            Existencias de productos que llevan control de inventario.
          </p>
        </div>
        {canRegister && (
          <div className="self-start">
            <NewMovementDialog
              triggerLabel="Nuevo movimiento"
              rows={rows}
              unitCode={unitCode}
              onRegister={registerMovement}
            />
          </div>
        )}
      </div>

      <div className="bg-background/95 sticky top-2 z-10 space-y-3 rounded-xl border p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder="Buscar producto por nombre o SKU…"
            containerClassName="min-w-0 flex-1"
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Buscar por código de barras con la cámara"
            onClick={() => setScannerOpen(true)}
          >
            <ScanBarcode />
          </Button>

          <Select
            items={[
              { value: 'all', label: 'Todas las categorías' },
              { value: NO_CATEGORY, label: 'Sin categoría' },
              ...activeCategories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={filterCategory}
            onValueChange={(value) => {
              setFilterCategory(value ?? 'all')
              setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Filtrar inventario por categoría"
              className="w-full shrink-0 sm:w-48"
            >
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
              {activeCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={stockFilter === 'all' ? 'default' : 'outline'}
            aria-pressed={stockFilter === 'all'}
            onClick={() => {
              setStockFilter('all')
              setPage(1)
            }}
          >
            Todos ({rows.length})
          </Button>
          <Button
            variant={stockFilter === 'out' ? 'default' : 'outline'}
            aria-pressed={stockFilter === 'out'}
            onClick={() => {
              setStockFilter((value) => (value === 'out' ? 'all' : 'out'))
              setPage(1)
            }}
          >
            Agotados ({rows.filter((row) => row.quantityOnHand <= 0).length})
          </Button>
          <Button
            variant={stockFilter === 'low' ? 'default' : 'outline'}
            aria-pressed={stockFilter === 'low'}
            disabled={minimumsLoading || !!minimumsError}
            onClick={() => {
              setStockFilter((value) => (value === 'low' ? 'all' : 'low'))
              setPage(1)
            }}
          >
            Por reponer (
            {
              rows.filter((row) =>
                needsReplenishment(
                  row.quantityOnHand,
                  minimums.get(row.product.id) ?? 0,
                ),
              ).length
            }
            )
          </Button>
          {canRegister && (
            <Button
              variant="outline"
              disabled={
                loading ||
                !!error ||
                minimumsLoading ||
                !!minimumsError ||
                !filteredRows.some((row) =>
                  needsReplenishment(
                    row.quantityOnHand,
                    minimums.get(row.product.id) ?? 0,
                  ),
                )
              }
              onClick={() =>
                downloadReplenishment(
                  replenishmentCsv(filteredRows, minimums, unitCode),
                )
              }
            >
              Descargar reposición
            </Button>
          )}
          <span className="text-muted-foreground text-sm">
            {filteredRows.length} productos
          </span>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setFilterCategory('all')
              setStockFilter('all')
              setPage(1)
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>
      {canRegister &&
        renderReplenishment?.(
          filteredRows,
          minimums,
          loading || !!error || minimumsLoading || !!minimumsError,
        )}
      <div className="grid gap-3 sm:hidden">
        {loading &&
          rows.length === 0 &&
          Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        {!loading && !error && filteredRows.length === 0 && (
          <EmptyState
            icon={Boxes}
            title="Sin resultados"
            description="No hay productos que coincidan con estos filtros."
          />
        )}
        {pageItems.map((row) => (
          <article
            key={row.product.id}
            className="bg-card border-border space-y-3 rounded-xl border p-4"
          >
            <div className="flex items-start gap-3">
              {row.product.image_url && (
                <img
                  src={row.product.image_url}
                  alt=""
                  className="size-12 rounded-md object-cover"
                />
              )}
              <div className="min-w-0">
                <h2 className="font-medium wrap-break-word">
                  {row.product.name}
                </h2>
                <p className="text-muted-foreground text-xs wrap-break-word">
                  {row.product.sku ?? 'Sin código'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-semibold tabular-nums">
                {row.quantityOnHand} {unitCode(row.product.unit_id)}
              </p>
              <StockStatus
                quantity={row.quantityOnHand}
                minimum={minimums.get(row.product.id)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => {
                detailTrigger.current = event.currentTarget
                setSelectedProductId(row.product.id)
              }}
            >
              Ver detalle
            </Button>
          </article>
        ))}
      </div>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Existencia</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableSkeletonRows rows={6} columns={5} />}
            {!loading && !error && filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={Boxes}
                    title="Sin resultados"
                    description="No hay productos con control de inventario que coincidan con la búsqueda o el filtro."
                  />
                </TableCell>
              </TableRow>
            )}
            {pageItems.map((row) => (
              <TableRow key={row.product.id}>
                <TableCell>
                  {row.product.image_url ? (
                    <img
                      src={row.product.image_url}
                      alt=""
                      className="border-border size-9 min-w-9 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground border-border flex size-9 items-center justify-center rounded-md border">
                      <ImageOff className="size-4" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {row.product.name}
                </TableCell>
                <TableCell>{row.product.sku ?? '—'}</TableCell>
                <TableCell
                  className={
                    row.quantityOnHand <= 0 ? 'text-destructive' : undefined
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums">
                      {row.quantityOnHand} {unitCode(row.product.unit_id)}
                    </span>
                    <StockStatus
                      quantity={row.quantityOnHand}
                      minimum={minimums.get(row.product.id)}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      detailTrigger.current = event.currentTarget
                      setSelectedProductId(row.product.id)
                    }}
                  >
                    Ver detalle
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      {selectedRow && (
        <InventoryProductPanel
          key={selectedRow.product.id}
          row={selectedRow}
          returnFocus={detailTrigger}
          unit={unitCode(selectedRow.product.unit_id)}
          minimum={
            minimumsLoading || minimumsError
              ? undefined
              : (minimums.get(selectedRow.product.id) ?? 0)
          }
          canRegister={canRegister}
          onSaveMinimum={saveMinimum}
          onRegister={registerMovement}
          onClose={() => setSelectedProductId(null)}
        />
      )}
      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={(value) => {
          setSearch(value)
          setPage(1)
        }}
      />
    </div>
  )
}
