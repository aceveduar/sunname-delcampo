import {
  FileImage,
  ImageOff,
  LayoutGrid,
  Pencil,
  Plus,
  RefreshCw,
  ScanBarcode,
  SlidersHorizontal,
  TableIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { useProductFilters } from './useProductFilters'
import type { ProductView } from './ProductDirectory'

function FilterSelect({
  id,
  label,
  value,
  items,
  onChange,
}: {
  id: string
  label: string
  value: string
  items: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => onChange(next ?? 'all')}
      >
        <SelectTrigger
          id={id}
          className="min-h-8 w-full min-w-0 whitespace-normal data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none"
        >
          <SelectValue className="min-w-0 wrap-anywhere" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className="[&>:first-child]:min-w-0 [&>:first-child]:shrink [&>:first-child]:wrap-anywhere [&>:first-child]:whitespace-normal"
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ProductsToolbar({
  filters,
  view,
  onView,
  canManage,
  disabled,
  noUnits,
  refreshing,
  onRefresh,
  onCreate,
  onEditPrices,
  onPriceSheet,
  onScan,
}: {
  filters: ReturnType<typeof useProductFilters>
  view: ProductView
  onView: (view: ProductView) => void
  canManage: boolean
  disabled: boolean
  noUnits: boolean
  refreshing: boolean
  onRefresh: () => void
  onCreate: () => void
  onEditPrices: () => void
  onPriceSheet: () => void
  onScan: () => void
}) {
  const hasFilters = filters.filtersActive || !!filters.search.trim()
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Precios, presentaciones y disponibilidad de tus productos.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={onRefresh}
          >
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </Button>
          {canManage && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="sm" variant="outline" disabled={disabled} />
                  }
                >
                  <Pencil />
                  Precios
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem disabled={disabled} onClick={onEditPrices}>
                    <Pencil />
                    Editar precios
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={disabled} onClick={onPriceSheet}>
                    <FileImage />
                    Precios por foto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                disabled={disabled || noUnits}
                onClick={onCreate}
              >
                <Plus />
                Nuevo producto
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="bg-card min-w-0 space-y-3 rounded-xl border p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <SearchInput
            value={filters.search}
            onChange={filters.setSearch}
            aria-label="Buscar productos"
            placeholder="Nombre o código de barras"
            containerClassName="min-w-0 flex-1"
          />
          <Button
            size="icon"
            variant="outline"
            aria-label="Buscar por código de barras con la cámara"
            onClick={onScan}
          >
            <ScanBarcode />
          </Button>
          <Button
            size="icon"
            variant={filters.filtersOpen ? 'default' : 'outline'}
            className="md:hidden"
            aria-label="Filtros de productos"
            aria-expanded={filters.filtersOpen}
            aria-controls="product-filters"
            onClick={() => filters.setFiltersOpen(!filters.filtersOpen)}
          >
            <SlidersHorizontal />
          </Button>
          <div
            className="hidden gap-1 lg:flex"
            role="group"
            aria-label="Presentación de productos"
          >
            <Button
              size="icon"
              variant={view === 'table' ? 'default' : 'ghost'}
              aria-label="Vista de tabla"
              aria-pressed={view === 'table'}
              onClick={() => onView('table')}
            >
              <TableIcon />
            </Button>
            <Button
              size="icon"
              variant={view === 'cards' ? 'default' : 'ghost'}
              aria-label="Vista de tarjetas"
              aria-pressed={view === 'cards'}
              onClick={() => onView('cards')}
            >
              <LayoutGrid />
            </Button>
          </div>
        </div>
        <div
          id="product-filters"
          className={`gap-3 md:grid md:grid-cols-3 ${filters.filtersOpen ? 'grid' : 'hidden'}`}
        >
          <FilterSelect
            id="filter-category"
            label="Categoría"
            value={filters.filterCategory}
            items={filters.categoryFilterItems}
            onChange={filters.setFilterCategory}
          />
          <FilterSelect
            id="filter-status"
            label="Estado"
            value={filters.filterActive}
            items={filters.statusFilterItems}
            onChange={(value) =>
              filters.setFilterActive(value as typeof filters.filterActive)
            }
          />
          <FilterSelect
            id="filter-weight"
            label="Modalidad de venta"
            value={filters.filterGranel}
            items={filters.granelFilterItems}
            onChange={(value) =>
              filters.setFilterGranel(value as typeof filters.filterGranel)
            }
          />
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Productos por completar"
        >
          <Button
            size="sm"
            variant={filters.filterMissing === 'photo' ? 'default' : 'ghost'}
            aria-pressed={filters.filterMissing === 'photo'}
            onClick={() =>
              filters.setFilterMissing(
                filters.filterMissing === 'photo' ? 'all' : 'photo',
              )
            }
          >
            <ImageOff />
            Sin foto
          </Button>
          <Button
            size="sm"
            variant={filters.filterMissing === 'sku' ? 'default' : 'ghost'}
            aria-pressed={filters.filterMissing === 'sku'}
            onClick={() =>
              filters.setFilterMissing(
                filters.filterMissing === 'sku' ? 'all' : 'sku',
              )
            }
          >
            <ScanBarcode />
            Sin código
          </Button>
          <Button
            size="sm"
            variant={filters.filterNoPrice ? 'default' : 'ghost'}
            aria-pressed={filters.filterNoPrice}
            onClick={() => filters.setFilterNoPrice(!filters.filterNoPrice)}
          >
            Sin precio
          </Button>
          {hasFilters && (
            <Button size="sm" variant="outline" onClick={filters.clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
