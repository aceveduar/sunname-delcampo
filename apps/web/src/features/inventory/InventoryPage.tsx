import { useMemo, useState } from 'react'
import { ImageOff } from 'lucide-react'
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
import { useCategories } from '@/features/catalog/useCategories'
import { useUnits } from '@/features/catalog/useUnits'
import type { Database } from '@/lib/database.types'
import { usePagination } from '@/lib/usePagination'
import { normalizeSearch } from '@/lib/text'
import { useInventoryStock } from './useInventoryStock'
import { useRegisterMovement } from './useRegisterMovement'
import { NewMovementDialog } from './NewMovementDialog'

type Role = Database['public']['Enums']['user_role']

const CAN_REGISTER_MOVEMENTS: Role[] = ['owner', 'local_admin']
const NO_CATEGORY = 'none'

export function InventoryPage({ role }: { role: Role | null }) {
  const { rows, loading, refresh } = useInventoryStock()
  const { units } = useUnits()
  const { categories } = useCategories()
  const registerMovement = useRegisterMovement(refresh)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  const canRegister = role !== null && CAN_REGISTER_MOVEMENTS.includes(role)
  const activeCategories = categories.filter((c) => c.active)

  const unitCode = (unitId: string) =>
    units.find((u) => u.id === unitId)?.code ?? ''

  const filteredRows = useMemo(() => {
    const query = normalizeSearch(search)
    return rows.filter((row) => {
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
  }, [rows, search, filterCategory])

  const { pageItems, page, setPage, totalPages, totalItems, pageSize } =
    usePagination(filteredRows)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Inventario</h1>
          <p className="text-muted-foreground text-sm">
            Existencias de productos que llevan control de inventario.
          </p>
        </div>
        {canRegister && (
          <NewMovementDialog
            triggerLabel="Nuevo movimiento"
            rows={rows}
            unitCode={unitCode}
            onRegister={registerMovement}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar producto por nombre o SKU…"
          containerClassName="max-w-sm min-w-[200px] flex-1"
        />

        <Select
          items={[
            { value: 'all', label: 'Todas las categorías' },
            { value: NO_CATEGORY, label: 'Sin categoría' },
            ...activeCategories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={filterCategory}
          onValueChange={(value) => setFilterCategory(value ?? 'all')}
        >
          <SelectTrigger className="w-48">
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Existencia</TableHead>
            {canRegister && (
              <TableHead className="text-right">Acciones</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && filteredRows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={canRegister ? 5 : 4}
                className="text-muted-foreground text-center"
              >
                No hay productos con control de inventario que coincidan.
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
              <TableCell className="font-medium">{row.product.name}</TableCell>
              <TableCell>{row.product.sku ?? '—'}</TableCell>
              <TableCell
                className={
                  row.quantityOnHand <= 0 ? 'text-destructive' : undefined
                }
              >
                {row.quantityOnHand} {unitCode(row.product.unit_id)}
              </TableCell>
              {canRegister && (
                <TableCell className="text-right">
                  <NewMovementDialog
                    triggerLabel="Ajustar"
                    triggerVariant="ghost"
                    triggerSize="sm"
                    rows={rows}
                    unitCode={unitCode}
                    initialProductId={row.product.id}
                    onRegister={registerMovement}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <PaginationControls
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  )
}
