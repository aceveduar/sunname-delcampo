import { useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { PaginationControls } from '@/components/PaginationControls'
import { useUnits } from '@/features/catalog/useUnits'
import type { Database } from '@/lib/database.types'
import { usePagination } from '@/lib/usePagination'
import { useInventoryStock } from './useInventoryStock'
import { useRegisterMovement } from './useRegisterMovement'
import { NewMovementDialog } from './NewMovementDialog'

type Role = Database['public']['Enums']['user_role']

const CAN_REGISTER_MOVEMENTS: Role[] = ['owner', 'local_admin']

export function InventoryPage({ role }: { role: Role | null }) {
  const { rows, loading, refresh } = useInventoryStock()
  const { units } = useUnits()
  const registerMovement = useRegisterMovement(refresh)
  const [search, setSearch] = useState('')

  const canRegister = role !== null && CAN_REGISTER_MOVEMENTS.includes(role)

  const unitCode = (unitId: string) => units.find((u) => u.id === unitId)?.code ?? ''

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(
      (row) =>
        row.product.name.toLowerCase().includes(query) ||
        row.product.sku?.toLowerCase().includes(query),
    )
  }, [rows, search])

  const { pageItems, page, setPage, totalPages, totalItems, pageSize } =
    usePagination(filteredRows)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inventario</h1>
          <p className="text-muted-foreground text-sm">
            Existencias de productos que llevan control de inventario.
          </p>
        </div>
        {canRegister && (
          <NewMovementDialog triggerLabel="Nuevo movimiento" rows={rows} onRegister={registerMovement} />
        )}
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar producto por nombre o SKU…"
        className="max-w-sm"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Existencia</TableHead>
            {canRegister && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && filteredRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={canRegister ? 4 : 3} className="text-muted-foreground text-center">
                No hay productos con control de inventario que coincidan.
              </TableCell>
            </TableRow>
          )}
          {pageItems.map((row) => (
            <TableRow key={row.product.id}>
              <TableCell className="font-medium">{row.product.name}</TableCell>
              <TableCell>{row.product.sku ?? '—'}</TableCell>
              <TableCell className={row.quantityOnHand <= 0 ? 'text-destructive' : undefined}>
                {row.quantityOnHand} {unitCode(row.product.unit_id)}
              </TableCell>
              {canRegister && (
                <TableCell className="text-right">
                  <NewMovementDialog
                    triggerLabel="Ajustar"
                    triggerVariant="ghost"
                    triggerSize="sm"
                    rows={rows}
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
