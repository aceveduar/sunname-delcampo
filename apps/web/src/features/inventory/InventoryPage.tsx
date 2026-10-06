import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Warehouse } from 'lucide-react'
import { InventoryProductPanel } from './InventoryProductPanel'
import { useInventoryMinimums } from './useInventoryMinimums'
import {
  downloadReplenishment,
  needsReplenishment,
  replenishmentCsv,
} from './replenishment'
import { LoadError } from '@/components/LoadError'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { RefreshCw, ScanBarcode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BarcodeScannerDialog } from '@/components/BarcodeScannerDialog'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PaginationControls } from '@/components/PaginationControls'
import { NO_CATEGORY, useCategories } from '@/features/catalog/useCategories'
import { useUnits } from '@/features/catalog/useUnits'
import type { Database } from '@/lib/database.types'
import { usePagination } from '@/lib/usePagination'
import { searchStockRows } from './inventorySearch'
import { InventoryResults } from './InventoryResults'
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
  const { rows, loading, error, refresh, updatedAt } = useInventoryStock()
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
  const [params, setParams] = useSearchParams()
  const stockFilter = ['out', 'low'].includes(params.get('stock') ?? '')
    ? params.get('stock')!
    : 'all'
  const setStockFilter = (value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === 'all') next.delete('stock')
        else next.set('stock', value)
        return next
      },
      { replace: true },
    )
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
  const minimumsReady = !minimumsLoading && !minimumsError
  const refreshing =
    loading || minimumsLoading || unitsLoading || categoriesLoading
  const clearFilters = () => {
    setSearch('')
    setFilterCategory('all')
    setStockFilter('all')
    setPage(1)
  }
  const refreshAll = () => {
    void Promise.all([
      refresh(),
      refreshMinimums(),
      refreshUnits(),
      refreshCategories(),
    ])
  }
  const activeCategories = categories.filter((c) => c.active)

  const unitCode = (unitId: string) =>
    units.find((u) => u.id === unitId)?.code ?? ''

  const filteredRows = useMemo(() => {
    return searchStockRows(rows, search).filter((row) => {
      if (stockFilter === 'out' && row.quantityOnHand > 0) return false
      if (
        stockFilter === 'low' &&
        !needsReplenishment(
          row.quantityOnHand,
          minimums.get(row.product.id) ?? 0,
        )
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
      <PageHeader
        icon={Warehouse}
        title="Inventario"
        description="Detecta faltantes y encuentra lo que necesita tu almacén."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={refreshAll}
              disabled={refreshing}
            >
              <RefreshCw
                aria-hidden
                className={
                  'size-4 ' +
                  (refreshing ? 'animate-spin motion-reduce:animate-none' : '')
                }
              />
              {refreshing ? 'Actualizando…' : 'Actualizar'}
            </Button>
            {canRegister && (
              <NewMovementDialog
                triggerLabel="Nuevo movimiento"
                rows={rows}
                unitCode={unitCode}
                onRegister={registerMovement}
                disabled={loading || !!error || unitsLoading || !!unitsError}
              />
            )}
          </div>
        }
      />

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
              setStockFilter(stockFilter === 'out' ? 'all' : 'out')
              setPage(1)
            }}
          >
            Sin existencias (
            {rows.filter((row) => row.quantityOnHand <= 0).length})
          </Button>
          <Button
            variant={stockFilter === 'low' ? 'default' : 'outline'}
            aria-pressed={stockFilter === 'low'}
            disabled={minimumsLoading || !!minimumsError}
            onClick={() => {
              setStockFilter(stockFilter === 'low' ? 'all' : 'low')
              setPage(1)
            }}
          >
            Por reponer (
            {!minimumsReady
              ? '—'
              : rows.filter((row) =>
                  needsReplenishment(
                    row.quantityOnHand,
                    minimums.get(row.product.id) ?? 0,
                  ),
                ).length}
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
            {filteredRows.length} de {rows.length} productos
          </span>
          {updatedAt && (
            <span className="text-muted-foreground ml-auto text-xs">
              Actualizado{' '}
              {updatedAt.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters}>
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
      <InventoryResults
        rows={pageItems}
        minimums={minimumsReady ? minimums : undefined}
        unitCode={unitCode}
        loading={loading || (stockFilter === 'low' && minimumsLoading)}
        hasError={!!error || (stockFilter === 'low' && !!minimumsError)}
        hasFilters={hasFilters}
        onClear={clearFilters}
        onOpen={(id, trigger) => {
          detailTrigger.current = trigger
          setSelectedProductId(id)
        }}
      />

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
          stockUnavailable={loading || !!error || unitsLoading || !!unitsError}
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
