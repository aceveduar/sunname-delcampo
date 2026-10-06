import { useMemo, useState } from 'react'
import { Truck, Mail, Phone, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { EmptyState } from '@/components/EmptyState'
import { PaginationControls } from '@/components/PaginationControls'
import { usePagination } from '@/lib/usePagination'
import { normalizeSearch } from '@/lib/text'
import type { Supplier } from './useSuppliers'

export function SupplierDirectory({
  suppliers,
  loading,
  error,
  onEdit,
  onToggle,
  onView,
}: {
  suppliers: Supplier[]
  loading: boolean
  error: string | null
  onEdit: (supplier: Supplier) => void
  onToggle: (supplier: Supplier) => void
  onView?: (supplier: Supplier) => void
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const filtered = useMemo(() => {
    const query = normalizeSearch(search)
    const digits = search.replace(/\D/g, '')
    return suppliers.filter(
      (supplier) =>
        (status === 'all' || supplier.active === (status === 'active')) &&
        (!query ||
          [
            supplier.name,
            supplier.contact_name,
            supplier.email,
            supplier.phone,
          ].some((value) => value && normalizeSearch(value).includes(query)) ||
          (digits.length >= 3 &&
            /^[\d\s()+-]+$/.test(search) &&
            supplier.phone?.replace(/\D/g, '').includes(digits))),
    )
  }, [suppliers, search, status])
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } =
    usePagination(filtered)
  const active = suppliers.filter((supplier) => supplier.active).length
  const filters = [
    { id: 'all', label: 'Todos', count: suppliers.length },
    { id: 'active', label: 'Activos', count: active },
    { id: 'inactive', label: 'Inactivos', count: suppliers.length - active },
  ]
  const actions = (supplier: Supplier) => (
    <>
      <Button variant="outline" size="sm" onClick={() => onEdit(supplier)}>
        Editar
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onToggle(supplier)}>
        {supplier.active ? 'Desactivar' : 'Activar'}
      </Button>
    </>
  )
  const state = (supplier: Supplier) => (
    <Badge
      variant="outline"
      className={
        supplier.active
          ? 'bg-success/10 text-success border-success/20'
          : 'text-muted-foreground'
      }
    >
      {supplier.active ? 'Activo' : 'Inactivo'}
    </Badge>
  )
  return (
    <section className="space-y-4" aria-label="Directorio de proveedores">
      <div className="bg-card flex flex-wrap items-center gap-3 rounded-xl border p-3 shadow-sm">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Nombre, contacto, teléfono o correo"
          aria-label="Buscar proveedores"
          containerClassName="min-w-0 basis-full sm:flex-1 sm:basis-auto"
        />
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Estado del proveedor"
        >
          {filters.map((filter) => (
            <Button
              key={filter.id}
              variant={status === filter.id ? 'default' : 'ghost'}
              aria-pressed={status === filter.id}
              size="sm"
              onClick={() => {
                setStatus(filter.id)
                setPage(1)
              }}
            >
              {filter.label}{' '}
              <span className="ml-1 text-xs opacity-75">
                {loading || error ? '—' : filter.count}
              </span>
            </Button>
          ))}
        </div>
      </div>
      {!loading && !error && (
        <p role="status" className="text-muted-foreground text-sm">
          {totalItems} {totalItems === 1 ? 'proveedor' : 'proveedores'}
          {search || status !== 'all'
            ? ' con estos filtros'
            : ' en tu directorio'}
        </p>
      )}
      {!loading && !error && !totalItems ? (
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={suppliers.length ? Search : Truck}
            title={
              suppliers.length
                ? 'No encontramos coincidencias'
                : 'Tu directorio empieza aquí'
            }
            description={
              suppliers.length
                ? 'Prueba con otro nombre, teléfono o estado.'
                : 'Usa Nuevo proveedor para guardar sus datos y preparar tu próxima compra.'
            }
          />
          {(search || status !== 'all') && (
            <div className="pb-6 text-center">
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setStatus('all')
                  setPage(1)
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableSkeletonRows rows={5} columns={4} />}
                {pageItems.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <div className="flex items-center gap-3 py-1">
                        <span
                          aria-hidden
                          className="bg-primary/8 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold"
                        >
                          {supplier.name
                            .trim()
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((word) => word[0])
                            .join('')
                            .toUpperCase()}
                        </span>
                        {onView ? (
                          <button
                            className="text-foreground text-left font-medium underline-offset-4 hover:underline"
                            onClick={() => onView(supplier)}
                          >
                            {supplier.name}
                            <span className="sr-only">: ver ficha</span>
                          </button>
                        ) : (
                          <span className="font-medium">{supplier.name}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-muted-foreground space-y-1">
                        {supplier.contact_name && (
                          <p className="text-foreground font-medium">
                            {supplier.contact_name}
                          </p>
                        )}
                        <p>{supplier.phone ?? 'Sin teléfono'}</p>
                        {supplier.email && <p>{supplier.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{state(supplier)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {actions(supplier)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-3 md:hidden">
            {loading && (
              <p role="status" className="text-muted-foreground">
                Cargando proveedores…
              </p>
            )}
            {pageItems.map((supplier) => (
              <article
                key={supplier.id}
                className="bg-card space-y-3 rounded-xl border p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 font-semibold wrap-break-word">
                    {onView ? (
                      <button
                        className="text-foreground text-left underline-offset-4 hover:underline"
                        onClick={() => onView(supplier)}
                      >
                        {supplier.name}
                        <span className="sr-only">: ver ficha</span>
                      </button>
                    ) : (
                      supplier.name
                    )}
                  </h2>
                  {state(supplier)}
                </div>
                <div className="text-muted-foreground space-y-2 text-sm">
                  {supplier.contact_name && (
                    <p className="text-foreground font-medium">
                      {supplier.contact_name}
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <Phone aria-hidden className="size-4 shrink-0" />
                    {supplier.phone ?? 'Sin teléfono'}
                  </p>
                  {supplier.email && (
                    <p className="flex items-start gap-2">
                      <Mail aria-hidden className="size-4 shrink-0" />
                      <span className="break-all">{supplier.email}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2 border-t pt-3">
                  {actions(supplier)}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {!loading && !error && totalItems > 0 && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </section>
  )
}
