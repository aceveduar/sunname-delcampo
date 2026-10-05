import { useMemo, useState } from 'react'
import { Contact, Mail, Phone, Search } from 'lucide-react'
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
import type { Customer } from './useCustomers'

export function CustomerDirectory({
  customers,
  loading,
  error,
  onEdit,
  onToggle,
  onView,
}: {
  customers: Customer[]
  loading: boolean
  error: string | null
  onEdit: (customer: Customer) => void
  onToggle: (customer: Customer) => void
  onView?: (customer: Customer) => void
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const filtered = useMemo(() => {
    const query = normalizeSearch(search)
    const digits = search.replace(/\D/g, '')
    return customers.filter(
      (customer) =>
        (status === 'all' || customer.active === (status === 'active')) &&
        (!query ||
          [customer.name, customer.email, customer.phone].some(
            (value) => value && normalizeSearch(value).includes(query),
          ) ||
          (digits.length >= 3 &&
            /^[\d\s()+-]+$/.test(search) &&
            customer.phone?.replace(/\D/g, '').includes(digits))),
    )
  }, [customers, search, status])
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } =
    usePagination(filtered)
  const active = customers.filter((customer) => customer.active).length
  const filters = [
    { id: 'all', label: 'Todos', count: customers.length },
    { id: 'active', label: 'Activos', count: active },
    { id: 'inactive', label: 'Inactivos', count: customers.length - active },
  ]
  const actions = (customer: Customer) => (
    <>
      <Button variant="outline" size="sm" onClick={() => onEdit(customer)}>
        Editar
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onToggle(customer)}>
        {customer.active ? 'Desactivar' : 'Activar'}
      </Button>
    </>
  )
  const state = (customer: Customer) => (
    <Badge
      variant="outline"
      className={
        customer.active
          ? 'bg-success/10 text-success border-success/20'
          : 'text-muted-foreground'
      }
    >
      {customer.active ? 'Activo' : 'Inactivo'}
    </Badge>
  )
  return (
    <section className="space-y-4" aria-label="Directorio de clientes">
      <div className="bg-card flex flex-wrap items-center gap-3 rounded-xl border p-3 shadow-sm">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Nombre, teléfono o correo"
          aria-label="Buscar clientes"
          containerClassName="min-w-0 basis-full sm:flex-1 sm:basis-auto"
        />
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Estado del cliente"
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
          {totalItems} {totalItems === 1 ? 'cliente' : 'clientes'}
          {search || status !== 'all'
            ? ' con estos filtros'
            : ' en tu directorio'}
        </p>
      )}
      {!loading && !error && !totalItems ? (
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={customers.length ? Search : Contact}
            title={
              customers.length
                ? 'No encontramos coincidencias'
                : 'Tu directorio empieza aquí'
            }
            description={
              customers.length
                ? 'Prueba con otro nombre, teléfono o estado.'
                : 'Usa Nuevo cliente para guardar sus datos y encontrarlo en tu próxima venta.'
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableSkeletonRows rows={5} columns={4} />}
                {pageItems.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3 py-1">
                        <span
                          aria-hidden
                          className="bg-primary/8 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold"
                        >
                          {customer.name
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
                            onClick={() => onView(customer)}
                          >
                            {customer.name}
                            <span className="sr-only">: ver ficha</span>
                          </button>
                        ) : (
                          <span className="font-medium">{customer.name}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-muted-foreground space-y-1">
                        <p>{customer.phone ?? 'Sin teléfono'}</p>
                        {customer.email && <p>{customer.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{state(customer)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {actions(customer)}
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
                Cargando clientes…
              </p>
            )}
            {pageItems.map((customer) => (
              <article
                key={customer.id}
                className="bg-card space-y-3 rounded-xl border p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 font-semibold wrap-break-word">
                    {onView ? (
                      <button
                        className="text-foreground text-left underline-offset-4 hover:underline"
                        onClick={() => onView(customer)}
                      >
                        {customer.name}
                        <span className="sr-only">: ver ficha</span>
                      </button>
                    ) : (
                      customer.name
                    )}
                  </h2>
                  {state(customer)}
                </div>
                <div className="text-muted-foreground space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <Phone aria-hidden className="size-4 shrink-0" />
                    {customer.phone ?? 'Sin teléfono'}
                  </p>
                  {customer.email && (
                    <p className="flex items-start gap-2">
                      <Mail aria-hidden className="size-4 shrink-0" />
                      <span className="break-all">{customer.email}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2 border-t pt-3">
                  {actions(customer)}
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
