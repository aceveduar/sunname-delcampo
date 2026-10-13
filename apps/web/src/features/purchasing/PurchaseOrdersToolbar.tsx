import type { ReactNode } from 'react'
import {
  ClipboardList,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { PURCHASE_FILTERS, type PurchaseFilter } from './purchaseOrderFilters'

const icons = [ClipboardList, Truck, PackageOpen, PackageCheck]
export function PurchaseOrdersToolbar({
  filter,
  counts,
  query,
  settled,
  refreshing,
  onFilter,
  onQuery,
  onClear,
  onRefresh,
  actions,
}: {
  filter: PurchaseFilter
  counts: Record<PurchaseFilter, number>
  query: string
  settled: boolean
  refreshing: boolean
  onFilter: (value: PurchaseFilter) => void
  onQuery: (value: string) => void
  onClear: () => void
  onRefresh: () => void
  actions: ReactNode
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Organiza lo que pediste y registra cada entrega al llegar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={onRefresh}
          >
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </Button>
          {actions}
        </div>
      </div>
      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        role="group"
        aria-label="Resumen de órdenes"
      >
        {PURCHASE_FILTERS.slice(0, 4).map((item, index) => {
          const Icon = icons[index]
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => onFilter(item.key)}
              className={`bg-card focus-visible:outline-primary hover:bg-accent flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${filter === item.key ? 'border-primary bg-primary/5' : ''}`}
            >
              <Icon className="text-primary size-5 shrink-0" />
              <span className="min-w-0">
                <span className="text-muted-foreground block text-xs wrap-anywhere">
                  {item.label}
                </span>
                <span className="block text-xl font-semibold tabular-nums">
                  {settled ? counts[item.key] : '—'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="bg-card space-y-3 rounded-xl border p-3 shadow-sm">
        <SearchInput
          value={query}
          onChange={onQuery}
          aria-label="Buscar órdenes"
          placeholder="Proveedor o folio de la orden"
        />
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Otros estados de órdenes"
        >
          {PURCHASE_FILTERS.slice(4).map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={filter === item.key ? 'default' : 'outline'}
              aria-pressed={filter === item.key}
              onClick={() => onFilter(item.key)}
            >
              {item.label}
              {settled ? ' (' + counts[item.key] + ')' : ''}
            </Button>
          ))}
          {(query.trim() || filter !== 'all') && (
            <Button size="sm" variant="ghost" onClick={onClear}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
